'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';

import * as loader from './metaInfoLoader';

export class BinaryFileLoader {
    private static binaryFileLoader : BinaryFileLoader;

    private _binaryFileBuffer! : Buffer;
    private _fileState : Error | undefined;
    private _metaInfo : loader.MetaInfoLoader | undefined;
    private _filePath : vscode.Uri | undefined;

    private constructor (meta : loader.MetaInfoLoader | undefined) {
        this._metaInfo = meta;

        this._binaryFileLoad();
    }

    get openedFile () {
        return this._binaryFileBuffer;
    }

    get openedFilePath() {
        return this._filePath;
    }

    get metaLoader () {
        return this._metaInfo;
    }

    get isOpen () {
        if (this._fileState)
            return false;
        else
            return true;
    }

    static get instance () {
        return this.binaryFileLoader;
    }

    public static binaryFileLoad() {
        BinaryFileLoader.binaryFileLoader = new BinaryFileLoader(undefined);
    }

    public static binaryFileLoadByMeta(meta : loader.MetaInfoLoader) {
        BinaryFileLoader.binaryFileLoader = new BinaryFileLoader(meta);
    }

    private _binaryFileLoad() {
        // const readFileAsync = util.promisify(fs.readFile);
        if (vscode.window.activeTextEditor === undefined) {
            vscode.window.showErrorMessage(
                "Cannot show hexdump because there is no active text editor.");
            return;
        }
        this._filePath = vscode.window.activeTextEditor.document.uri;

        this._binaryFileBuffer = fs.readFileSync(this._filePath.path);
        // await readFileAsync(filePath.path).then(
        //     val => {
        //         this._binaryFileBuffer = val;
        //         console.log("test");
        //     }
        // ).catch(reason => {
        //     console.log(reason);
        // });
        // try {
        // } catch (err) {
        //     this._fileState = err;
        // }
    }
}
