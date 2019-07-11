'use strict';

import * as vscode from 'vscode';

export enum EditType {
    REMOVED = "removed",
    MODIFIED = "modified"
}

export class EditState {
    private _offset : number;
    private _type : EditType;
    private _data? : string;
    private _parseData? : number;

    public constructor(data : { offset : string, command : string, data? : string } ) {
        this._offset = parseInt(data.offset);
        if (data.command == "removed") {
            this._type = EditType.REMOVED;
        } else {
            this._type = EditType.MODIFIED;
        }

        if (data.data) {
            this._data = data.data;
            this._parseData = parseInt(data.data, 16);
        }
    }

    get offset() : number {
        return this._offset;
    }

    get type() : EditType {
        return this._type;
    }

    get data() : string | undefined {
        return this._data;
    }

    get parseData() : number | undefined {
        return this._parseData;
    }
}

export class BinaryEditHelper {
    private binaryEdit : Map<number, EditState>;

    public constructor() {
        this.binaryEdit = new Map<number, EditState>();
    }

    get state() : Map<number, EditState> {
        return this.binaryEdit;
    }

    public editBinary(data : { offset : string, command : string, data? : string } ) {
        let editData : EditState = new EditState(data);
        this.binaryEdit.set(editData.offset, editData);
    }

    public saveAsFile(name : string) {
    }

    public saveFile(path : string) {
    }

    public restoreState() : { command : string, removed : Array<number>, modified : Array<{offset:number, data:string}> } {
        let removedElem : Array<number> = new Array<number>();
        let modifiedElem : Array<{offset:number, data:string}> = new Array<{offset:number, data:string}>();

        this.binaryEdit.forEach((value, key) => {
            if (value.type == EditType.REMOVED) {
                removedElem.push(key);
            } else if (value.data) {
                modifiedElem.push({
                    offset : key,
                    data : value.data
                });
            }
        });

        return {
            command : 'restore',
            removed : removedElem,
            modified : modifiedElem
        };
    }
}
