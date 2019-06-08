// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as loader from './metaInfoLoader';
import * as binLoader from './binaryDataLoader';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

// config
// custom binary format
// collapse

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
		console.log('Congratulations, your extension "binary-lover" is now active!');
		
		// The command has been defined in the package.json file
		// Now provide the implementation of the command with registerCommand
		// The commandId parameter must match the command field in package.json
		let disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
			// The code you place here will be executed every time your command is executed
			
			
		let filePath : vscode.Uri = vscode.Uri.file(path.join(context.extensionPath, 'src', 'resources'));
			
		let a : loader.MetaInfoLoader = new loader.MetaInfoLoader("elf", filePath);
		binLoader.BinaryDataLoader.createBinaryPanel(a);
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World!');

	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
