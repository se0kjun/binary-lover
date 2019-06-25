// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as loader from './metaInfoLoader';
import * as binLoader from './binaryDataLoader';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let metaInfoPick = vscode.window.createQuickPick();
	let offsetInput = vscode.window.createInputBox();

	metaInfoPick.items = ["default", "elf"].map(label => ({ label }));

	let disposable = vscode.commands.registerCommand('extension.showBinary', () => {
		metaInfoPick.show();
	});

	vscode.commands.registerCommand('extension.goToOffset', () => {
		offsetInput.onDidAccept(() => {
			binLoader.BinaryDataLoader.goToParticularOffset(Number.parseInt(offsetInput.value));
		});
		offsetInput.show();
	});

	metaInfoPick.title = "Choose binary format what you want to show. if not, shown as default viewer.";
	metaInfoPick.onDidAccept(e => {
		if (metaInfoPick.value != "") {
			binLoader.BinaryDataLoader.createBinaryPanel(
				context.extensionPath, metaInfoPick.value);
		} else {
			binLoader.BinaryDataLoader.createBinaryPanel(
				context.extensionPath, metaInfoPick.selectedItems[0].label);
		}
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
