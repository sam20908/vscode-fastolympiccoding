import * as fs from 'fs';
import * as vscode from 'vscode';

function getNonce(): string {
    const CHOICES = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let nonce = "";
    for (let i = 0; i < 32; i++) {
        nonce += CHOICES.charAt(Math.floor(Math.random() * CHOICES.length));
    }
    return nonce;
}

export interface IMessage {
    type: string;
    payload?: any;
};

export abstract class BaseViewProvider implements vscode.WebviewViewProvider {
    readonly storagePath: string;
    private _webview?: vscode.Webview = undefined;

    constructor(public readonly view: string, private _context: vscode.ExtensionContext) {
        this.storagePath = _context.globalStorageUri.fsPath;
    }

    abstract onMessage(message: IMessage): void;

    public resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._webview = webviewView.webview;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, 'dist', this.view)],
        };
        webviewView.webview.html = this._getWebviewContent(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(message => this.onMessage(message));
    }

    public getViewId(): string {
        return `fastolympiccoding.${this.view}`;
    }

    public writeStorage(file: string, data?: any): void {
        const fileData = this._readStorageJson();
        fileData[this.view] = { ...fileData[this.view] };
        if (!data) {
            delete fileData[this.view][file];
        } else {
            fileData[this.view][file] = { ...fileData[this.view][file], ...data };
        }
        fs.writeFileSync(this.storagePath, JSON.stringify(fileData));
    }

    protected _postMessage(type: string, payload?: any): void {
        this._webview?.postMessage({ type, payload });
    }

    protected _readStorage(): any {
        return this._readStorageJson()[this.view] ?? {};
    }

    private _readStorageJson(): any {
        try {
            const content = fs.readFileSync(this.storagePath, { encoding: 'utf-8' });
            return JSON.parse(content);
        } catch (_) {
            return {};
        }
    }

    private _getWebviewContent(webview: vscode.Webview): string {
        const config = vscode.workspace.getConfiguration('fastolympiccoding');
        const font = config.get('font')!;
        const scriptUri = this._getUri(webview, ['dist', this.view, 'index.js']);
        const stylesUri = this._getUri(webview, ['dist', this.view, 'index.css']);
        const nonce = getNonce();

        return `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' cdn.tailwindcss.com; script-src 'nonce-${nonce}';">
                <script nonce="${nonce}" src="https://cdn.tailwindcss.com"></script>
                <link rel="stylesheet" href="${stylesUri}">
                <style>
                    .display-font {
                        font-family: ${font};
                    };
                </style>
            </head>
        <body>
            <div id="root"></div>
            <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>
        `;
    }

    private _getUri(webview: vscode.Webview, paths: string[]): vscode.Uri {
        return webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, ...paths));
    }
}