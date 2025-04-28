import vscode from 'vscode';

function getNonce(): string {
    const CHOICES = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let nonce = "";
    for (let i = 0; i < 32; i++) {
        nonce += CHOICES.charAt(Math.floor(Math.random() * CHOICES.length));
    }
    return nonce;
}

export default abstract class <ProviderMessageType, WebviewMessageType> implements vscode.WebviewViewProvider {
    private _webview?: vscode.Webview = undefined;

    constructor(public readonly view: string, protected _context: vscode.ExtensionContext) { }

    abstract onMessage(msg: ProviderMessageType): void;
    abstract onDispose(): void;

    public resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._webview = webviewView.webview;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, 'dist')],
        };
        webviewView.webview.html = this._getWebviewContent(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(message => this.onMessage(message));
        webviewView.onDidDispose(() => this.onDispose());
        webviewView.onDidChangeVisibility(() => this.onDispose()); // webviews don't have persistent states
    }

    public getViewId(): string {
        return `fastolympiccoding.${this.view}`;
    }

    public readStorage(): any {
        return this._context.workspaceState.get<any>(this.view, {});
    }

    public writeStorage(file: string, data: any): void {
        const fileData = this._context.workspaceState.get<any>(this.view, {});
        this._context.workspaceState.update(this.view, { ...fileData, [`${file}`]: data });
    }

    public clearData() {
        this._context.workspaceState.update(this.view, undefined);
    }

    protected _postMessage(msg: WebviewMessageType): void {
        this._webview?.postMessage(msg);
    }

    private _getWebviewContent(webview: vscode.Webview): string {
        const config = vscode.workspace.getConfiguration('fastolympiccoding');
        const font = config.get('font')!;
        const scriptUri = this._getUri(webview, ['dist', this.view, 'index.js']);
        const stylesUri = this._getUri(webview, ['dist', 'styles.css']);
        const nonce = getNonce();

        return `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
                <link rel="stylesheet" href="${stylesUri}">
                <style nonce="${nonce}">
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