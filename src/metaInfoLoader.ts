'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class MetaInfoLoader {
    private fileType : string;
    private resPath : vscode.Uri;
    private readonly fileName : string;

    private label? : string;
    private fileMagicNumber? : string;

    private fileMetaInfo? : MetaField[];

    constructor (fileType : string, resPath : vscode.Uri) {
        this.fileType = fileType;
        this.resPath = resPath;
        this.fileName = this.fileType + ".json";
        this.loadData();
    }

    private loadData() {
        let jsonString = fs.readFileSync(path.join(this.resPath.fsPath, this.fileName), "utf8");
        let obj = JSON.parse(jsonString);
    }
}

export class MetaField {
    private id : string;
    private _value? : number;
    private _offset? : number;
    private _length? : number;
    private _fieldType? : FieldType;
    private _fieldLengthType? : FieldLengthType;
    private _referField? : MetaField;

    constructor (id : string) {
        this.id = id;
    }

    set value(val : number) {
        this._value = val;
    }
}

enum FieldType {
    HEADER,
    PLAIN,
    REFERENCE
}

enum FieldLengthType {
    VARIABLE,
    FIXED
}
