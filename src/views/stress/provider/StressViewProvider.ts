import * as path from 'node:path';
import * as vscode from 'vscode';

import { Status } from '~common/common';
import type { ILanguageSettings } from '~common/provider';
import BaseViewProvider from '~utils/BaseViewProvider';
import { Runnable, compile } from '~utils/runtime';
import {
	TextHandler,
	openInNewEditor,
	resolveCommand,
	resolveVariables,
} from '~utils/vscode';
import type JudgeViewProvider from '../../judge/provider/JudgeViewProvider';
import {
	type IAddMessage,
	type IViewMessage,
	type ProviderMessage,
	ProviderMessageType,
	type WebviewMessage,
	WebviewMessageType,
} from '../message';

interface IData {
	data: string;
	status: Status;
}

interface IState {
	data: TextHandler;
	status: Status;
	process: Runnable;
}

export default class extends BaseViewProvider<ProviderMessage, WebviewMessage> {
	private _state: IState[] = [
		{ data: new TextHandler(), status: Status.NA, process: new Runnable() },
		{ data: new TextHandler(), status: Status.NA, process: new Runnable() },
		{ data: new TextHandler(), status: Status.NA, process: new Runnable() },
	]; // [generator, solution, good solution]
	private _stopFlag = false;

	onMessage(msg: ProviderMessage): void {
		switch (msg.type) {
			case ProviderMessageType.LOADED:
				this.loadCurrentFileData();
				break;
			case ProviderMessageType.RUN:
				void this.run();
				break;
			case ProviderMessageType.STOP:
				this.stop();
				break;
			case ProviderMessageType.VIEW:
				this._view(msg);
				break;
			case ProviderMessageType.ADD:
				this._add(msg);
				break;
			case ProviderMessageType.RESET:
				this._reset();
				break;
		}
	}

	onDispose() {
		this.stop();
	}

	constructor(
		context: vscode.ExtensionContext,
		private _testcaseViewProvider: JudgeViewProvider,
	) {
		super('stress', context);

		for (let id = 0; id < 3; id++) {
			this._state[id].data.callback = (data: string) =>
				super._postMessage({ type: WebviewMessageType.STDIO, id, data });
		}

		vscode.window.onDidChangeActiveTextEditor(
			() => this.loadCurrentFileData(),
			this,
		);
	}

	loadCurrentFileData() {
		this.stop();
		for (let id = 0; id < 3; id++) {
			this._state[id].data.reset();
			this._state[id].status = Status.NA;
			super._postMessage({
				type: WebviewMessageType.STATUS,
				id,
				status: Status.NA,
			});
		}
		super._postMessage({ type: WebviewMessageType.CLEAR });

		const file = vscode.window.activeTextEditor?.document.fileName;
		if (!file) {
			super._postMessage({ type: WebviewMessageType.SHOW, visible: false });
			return;
		}
		super._postMessage({ type: WebviewMessageType.SHOW, visible: true });

		const fileData = super.readStorage()[file];
		const state = fileData && Array.isArray(fileData) ? fileData : [];
		for (let id = 0; id < state.length; id++) {
			const testcase =
				state[id] !== 'null' && typeof state[id] === 'object'
					? (state[id] as Partial<IData>)
					: {};

			this._state[id].data.write(testcase.data ?? '', true);
			this._state[id].status = testcase.status ?? Status.NA;
			super._postMessage({
				type: WebviewMessageType.STATUS,
				id,
				status: this._state[id].status,
			});
		}
	}

	async run(): Promise<void> {
		const file = vscode.window.activeTextEditor?.document.fileName;
		if (!file) {
			return;
		}

		const extension = path.extname(file);
		const config = vscode.workspace.getConfiguration('fastolympiccoding');
		const runSettings = vscode.workspace.getConfiguration(
			'fastolympiccoding.runSettings',
		);
		// biome-ignore lint/style/noNonNullAssertion: Default value provided by VSCode
		const delayBetweenTestcases = config.get<number>('delayBetweenTestcases')!;

		const languageSettings = runSettings[extension] as
			| ILanguageSettings
			| undefined;
		if (!languageSettings) {
			vscode.window.showWarningMessage(
				`No run setting detected for file extension "${extension}"`,
			);
			return;
		}

		if (languageSettings.compileCommand) {
			for (let id = 0; id < 3; id++) {
				super._postMessage({
					type: WebviewMessageType.STATUS,
					id,
					status: Status.COMPILING,
				});
			}

			const callback = (id: number, code: number) => {
				const status = code ? Status.CE : Status.NA;
				this._state[id].status = status;
				super._postMessage({ type: WebviewMessageType.STATUS, id, status });
				return code;
			};
			const promises = [
				compile(
					// biome-ignore lint/style/noNonNullAssertion: Default value provided by VSCode
					resolveVariables(config.get('generatorFile')!),
					languageSettings.compileCommand,
					this._context,
				).then(callback.bind(this, 0)),
				compile(
					resolveVariables('${file}'),
					languageSettings.compileCommand,
					this._context,
				).then(callback.bind(this, 1)),
				compile(
					// biome-ignore lint/style/noNonNullAssertion: Default value provided by VSCode
					resolveVariables(config.get('goodSolutionFile')!),
					languageSettings.compileCommand,
					this._context,
				).then(callback.bind(this, 2)),
			];
			const codes = await Promise.all(promises);

			for (let i = 0; i < 3; i++) {
				if (codes[i]) {
					return;
				}
			}
		}

		super._postMessage({ type: WebviewMessageType.RUNNING, value: true });
		for (let id = 0; id < 3; id++) {
			super._postMessage({
				type: WebviewMessageType.STATUS,
				id,
				status: Status.RUNNING,
			});
		}

		const cwd = languageSettings.currentWorkingDirectory
			? resolveVariables(languageSettings.currentWorkingDirectory)
			: undefined;
		// biome-ignore lint/style/noNonNullAssertion: Default value provided by VSCode
		const testcaseTimeLimit = config.get<number>('stressTestcaseTimeLimit')!;
		// biome-ignore lint/style/noNonNullAssertion: Default value provided by VSCode
		const timeLimit = config.get<number>('stressTimeLimit')!;
		const start = Date.now();

		let anyFailed = false;
		this._stopFlag = false;
		while (
			!this._stopFlag &&
			(timeLimit === 0 || Date.now() - start <= timeLimit)
		) {
			super._postMessage({ type: WebviewMessageType.CLEAR });
			for (let i = 0; i < 3; i++) {
				this._state[i].data.reset();
			}

			const seed = Math.round(Math.random() * 9007199254740991);
			const generatorRunArguments = this._resolveRunArguments(
				languageSettings.runCommand,
				// biome-ignore lint/style/noNonNullAssertion: Default value provided by VSCode
				config.get('generatorFile')!,
			);
			this._state[0].process.run(
				generatorRunArguments[0],
				testcaseTimeLimit,
				cwd,
				...generatorRunArguments.slice(1),
			);
			this._state[0].process.process?.on('error', (data) => {
				if (data.name !== 'AbortError') {
					this._state[0].data.write(data.message, true);
				}
			});
			this._state[0].process.process?.stdin.write(`${seed}\n`);
			this._state[0].process.process?.stdout.on('data', (data: string) => {
				this._state[0].data.write(data, false);
				this._state[1].process.process?.stdin.write(data);
				this._state[2].process.process?.stdin.write(data);
			});
			this._state[0].process.process?.stdout.once('end', () =>
				this._state[0].data.write('', true),
			);

			const solutionRunArguments = this._resolveRunArguments(
				languageSettings.runCommand,
				'${file}',
			);
			this._state[1].process.run(
				solutionRunArguments[0],
				testcaseTimeLimit,
				cwd,
				...solutionRunArguments.slice(1),
			);
			this._state[1].process.process?.on('error', (data) => {
				if (data.name !== 'AbortError') {
					this._state[1].data.write(data.message, true);
				}
			});
			this._state[1].process.process?.stdout.on('data', (data: string) =>
				this._state[1].data.write(data, false),
			);
			this._state[1].process.process?.stdout.once('end', () =>
				this._state[1].data.write('', true),
			);

			const goodSolutionRunArguments = this._resolveRunArguments(
				languageSettings.runCommand,
				// biome-ignore lint/style/noNonNullAssertion: Default value provided by VSCode
				config.get('goodSolutionFile')!,
			);
			this._state[2].process.run(
				goodSolutionRunArguments[0],
				testcaseTimeLimit,
				cwd,
				...goodSolutionRunArguments.slice(1),
			);
			this._state[2].process.process?.on('error', (data) => {
				if (data.name !== 'AbortError') {
					this._state[2].data.write(data.message, true);
				}
			});
			this._state[2].process.process?.stdout.on('data', (data: string) =>
				this._state[2].data.write(data, false),
			);
			this._state[2].process.process?.stdout.once('end', () =>
				this._state[2].data.write('', true),
			);

			for (let i = 0; i < 3; i++) {
				// if any process fails then the other 2 should be gracefully closed
				this._state[i].process.process?.once('close', (code) => {
					if (code === null || code) {
						for (let j = 0; j < 3; j++) {
							if (j !== i) {
								this._state[j].process.process?.kill('SIGUSR1');
							}
						}
					}
				});
			}

			await Promise.allSettled(
				this._state.map((value) => value.process.promise),
			);
			for (let i = 0; i < 3; i++) {
				if (this._state[i].process.timedOut) {
					anyFailed = true;
					this._state[i].status = Status.TL;
				} else if (this._state[i].process.signal === 'SIGUSR1') {
					this._state[i].status = Status.NA;
				} else if (this._state[i].process.exitCode !== 0) {
					anyFailed = true;
					this._state[i].status = Status.RE;
				} else {
					this._state[i].status = Status.NA;
				}
			}
			if (anyFailed || this._state[1].data.data !== this._state[2].data.data) {
				break;
			}
			await new Promise<void>((resolve) =>
				setTimeout(() => resolve(), delayBetweenTestcases),
			);
		}
		super._postMessage({ type: WebviewMessageType.RUNNING, value: false });

		if (!anyFailed && this._state[1].data.data !== this._state[2].data.data) {
			this._state[1].status = Status.WA;
		}
		for (let id = 0; id < 3; id++) {
			super._postMessage({
				type: WebviewMessageType.STATUS,
				id,
				status: this._state[id].status,
			});
		}
		this._saveState();
	}

	stop() {
		this._stopFlag = true;
		for (let i = 0; i < 3; i++) {
			this._state[i].process.process?.kill('SIGUSR1');
		}
	}

	private _view({ id }: IViewMessage) {
		void openInNewEditor(this._state[id].data.data);
	}

	private _add({ id }: IAddMessage) {
		const file = vscode.window.activeTextEditor?.document.fileName;
		if (!file) {
			return;
		}

		let resolvedFile: string;
		if (id === 0) {
			resolvedFile = resolveVariables(
				// biome-ignore lint/style/noNonNullAssertion: Default value provided by VSCode
				vscode.workspace
					.getConfiguration('fastolympiccoding')
					.get('generatorFile')!,
			);
		} else if (id === 1) {
			resolvedFile = file;
		} else {
			resolvedFile = resolveVariables(
				// biome-ignore lint/style/noNonNullAssertion: Default value provided by VSCode
				vscode.workspace
					.getConfiguration('fastolympiccoding')
					.get('goodSolutionFile')!,
			);
		}

		this._testcaseViewProvider.addTestcaseToFile(resolvedFile, {
			stdin: this._state[0].data.data,
			stderr: '',
			stdout: this._state[1].data.data,
			acceptedStdout: this._state[2].data.data,
			elapsed: 0,
			status: this._state[id].status,
			shown: true,
			toggled: false,
			skipped: false,
		});
	}

	private _reset() {
		const file = vscode.window.activeTextEditor?.document.fileName;
		if (!file) {
			return;
		}

		for (let i = 0; i < 3; i++) {
			this._state[i].data.reset();
			this._state[i].status = Status.NA;
		}
		super._postMessage({ type: WebviewMessageType.CLEAR });
		this._saveState();
	}

	private _saveState() {
		const file = vscode.window.activeTextEditor?.document.fileName;
		if (!file) {
			return;
		}

		let isDefault = true;
		for (const state of this._state) {
			isDefault &&= state.data.data === '';
			isDefault &&= state.status === Status.NA;
		}
		super.writeStorage(
			file,
			isDefault
				? undefined
				: this._state.map<IData>((value) => {
						return {
							data: value.data.data,
							status: value.status,
						};
					}),
		);
	}

	private _resolveRunArguments(runCommand: string, fileVariable: string) {
		const resolvedFile = resolveVariables(fileVariable);
		const resolvedArgs = resolveCommand(runCommand, resolvedFile);
		return resolvedArgs;
	}
}
