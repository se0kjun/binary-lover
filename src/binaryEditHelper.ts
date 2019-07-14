'use strict';

import * as vscode from 'vscode';
import { BinaryFileLoader } from './binaryFileLoader';
import * as fs from 'fs';

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

interface SaveContext {
    readonly originalBuf : Buffer;
    savedBuf : Buffer;
    savedBufOffset : number;
    lastRemovedOffset : number;
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

    public saveAsFile() {
        let saveFileName = vscode.window.createInputBox();
        saveFileName.show();
		saveFileName.onDidAccept(() => {
            if (saveFileName.value.indexOf("/") >= 0) {
                this.saveFile(saveFileName.value);
            } else {
                let saveFilePath = BinaryFileLoader.instance.openedFilePath;
                if (saveFilePath) {
                    this.saveFile(
                        saveFilePath.path.substring(0, saveFilePath.path.lastIndexOf("/") + 1) + saveFileName.value);
                }
            }
		});
    }

    public saveFile(path : string | undefined) {
        if (path) {
            fs.writeFile(path, this.applyChanges(), function(err) {
                if (err) {
                    return vscode.window.showErrorMessage(err.message);
                }

                vscode.window.showInformationMessage("File saved successfully: " + path);
            });
        } else {
            let saveFilePath = BinaryFileLoader.instance.openedFilePath;
            if (saveFilePath) {
                fs.writeFile(saveFilePath.path, this.applyChanges(), function(err) {
                    if (err) {
                        return vscode.window.showErrorMessage(err.message);
                    }

                    if (saveFilePath) {
                        vscode.window.showInformationMessage("File saved successfully: " + saveFilePath.path);
                    }
                });
            } else {
                vscode.window.showErrorMessage("File path not found");
            }
        }
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

    private applyChanges() : Buffer {
        let data = BinaryFileLoader.instance.openedFile;
        let modifiedItems =
            Array.from(this.binaryEdit.values()).filter(item => item.type == EditType.MODIFIED).sort((a, b) => a.offset - b.offset);
        let removedItems =
            Array.from(this.binaryEdit.values()).filter(item => item.type == EditType.REMOVED).sort((a, b) => a.offset - b.offset);

        modifiedItems.forEach(item => {
            if (item.parseData) {
                data[item.offset] = item.parseData;
            }
        });

        if (removedItems.length == 0) {
            return data;
        }

        let appliedBuf = removedItems.reduce((prev : SaveContext, curr) => {
            let copiedData = prev.originalBuf.slice(prev.lastRemovedOffset, curr.offset);
            copiedData.forEach(bin => {
                prev.savedBuf.writeUInt8(bin, prev.savedBufOffset);
                prev.savedBufOffset++;
            });
            prev.lastRemovedOffset = curr.offset+1;

            return prev;
        }, {
            originalBuf : data,
            savedBuf : Buffer.alloc(data.length - removedItems.length),
            savedBufOffset : 0,
            lastRemovedOffset : 0
        });

        if (appliedBuf.savedBufOffset+1 != appliedBuf.savedBuf.length) {
            let remaining = appliedBuf.savedBufOffset;
            data.slice(appliedBuf.lastRemovedOffset).forEach(bin => {
                appliedBuf.savedBuf.writeUInt8(bin, remaining);
                remaining++;
            })
        }

        return appliedBuf.savedBuf;
    }
}
