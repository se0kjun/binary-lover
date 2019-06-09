'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { tmpdir } from 'os';
import { BinaryFileLoader } from './binaryFileLoader';

export class MetaInfoLoader {
    // path of containing meta information
    private resPath : vscode.Uri;
    // meta file name
    private readonly fileName : string;
    // Normally, binary file has no file extension.
    // We need to know the way, such as magic number, to discriminate a format of a certain file
    private fileLabel : string;

    // file magic number
    private fileMagicNumber? : string;
    // file meta information
    private fileMetaInfo : Array<MetaField>;
    public binaryAndMetaMap : Array<[SourcePos, MetaField]>;

    constructor (fileType : string, resPath : vscode.Uri) {
        // file load
        this.fileLabel = fileType;
        this.resPath = resPath;
        this.fileName = this.fileLabel + ".json";
        this.fileMetaInfo = Array<MetaField>();
        this.binaryAndMetaMap  = new Array<[SourcePos, MetaField]>();

        // load meta information based on json file
        this.loadData();

        // resolve reference field
        this.resolveReferField();
    }

    /**
     * load resource file to get binary file
     */
    private loadData() {
        let jsonString = fs.readFileSync(path.join(this.resPath.fsPath, this.fileName), "utf8");
        let obj = JSON.parse(jsonString);
        let baseOffsetFlag = false;
        let pivotObject : MetaField | undefined;

        this.fileLabel = obj.fileLabel;
        this.fileMagicNumber = obj.fileMagicNumber;

        // load meta
        this.fileMetaInfo = obj.meta.reduce((data : any, item : any) => {
            const meta = data.meta;
            let prevField : MetaField | undefined = meta[meta.length - 1];
            let currField = new MetaField(item.id, item.label, item.description, item.fieldType, ValueMap[item.valueType]);
            let accLen = data.accLen;

            if (item.fieldType == FieldType.ARRAY) {
                let accArrayLen = 0;
                if (item.entry) {
                    currField.arrayEntryField = item.entry.reduce((entries : Array<MetaField>, arrayItem: { id: string; label: string; description: string; length: number | undefined; }) => {
                        let arrayItemField = new MetaField(arrayItem.id, arrayItem.label, arrayItem.description);
                        arrayItemField.length = arrayItem.length;
                        arrayItemField.baseOffsetField = item.entry[0];
                        arrayItemField.relativeOffset = accArrayLen;
                        entries.push(arrayItemField);

                        if (arrayItem.length)
                            accArrayLen += arrayItem.length;

                        return entries;
                    }, new Array<MetaField>());
                }
            }

            if (item.referField != undefined)
                currField.referField = item.referField;
            // specify length and length type
            if (item.length !== undefined) {
                currField.length = item.length;
                currField.relativeOffset = accLen;
                accLen += item.length;
                currField.valueLengthType = ValueLengthType.FIXED;
            }
            else {
                currField.valueLengthType = ValueLengthType.VARIABLE;
                if (prevField != undefined
                    && prevField.valueLengthType == ValueLengthType.FIXED) {
                    currField.relativeOffset = accLen;
                } else {
                    accLen = 0;
                }
            }

            if (prevField != undefined) {
                // previous field is VARIABLE and current field is FIXED, or
                // previous field is VARIABLE and current field is VARIABLE
                if ( (prevField.valueLengthType == ValueLengthType.VARIABLE
                    && currField.valueLengthType == ValueLengthType.FIXED) ||
                    (prevField.valueLengthType == ValueLengthType.VARIABLE
                    && currField.valueLengthType == ValueLengthType.VARIABLE)) {
                    pivotObject = currField;
                } else {
                    currField.baseOffsetField = pivotObject;
                }
            }
            // previous field is undefined, that is, current field is the first element
            else {
                pivotObject = currField;
            }

            meta.push(currField);

            return {
                "meta" : meta,
                "accLen" : accLen
            };
        }, {
            "meta" : Array<MetaField>(),
            "accLen" : 0
        }).meta;
    }

    /**
     * resolving reference field
     */
    private resolveReferField () {
        // change meta information to map, metaid and field
        // this variable is used to resolve reference fields
        let fileMetaMap : Map<string, MetaField> = this.fileMetaInfo.reduce(
            (data : any, item) => {
                data.set(item.fieldId, item);
                return data;
            }, new Map<string, MetaField>());

        this.fileMetaInfo.forEach(
            field => {
                field.referField.forEach(
                    referField => {
                        if (fileMetaMap.has(referField)) {
                            let item = fileMetaMap.get(referField);
                            if (item !== undefined)
                                field.addReferField(item);
                        }
                    }
                );
            }
        );
    }

    public applyBinaryInfo() {
        this.fileMetaInfo.reduce(
            (data : any, field) => {
                field.prevField = data;

                // TODO: handling optional field
                return field;
            }, undefined
        );
    }

    get fileMeta() {
        return this.fileMetaInfo;
    }
}

/**
 * class 'SourcePos' is used to specify relative position in binary file.
 */
export class SourcePos {
    private startPos : number;
    private endPos : number;

    constructor (startpos : number, endpos : number) {
        this.startPos = startpos;
        this.endPos = endpos;
    }

    get binaryStartPos() {
        return this.startPos;
    }

    get binaryEndPos() {
        return this.endPos;
    }

    get length() {
        return this.endPos - this.startPos;
    }
}

/**
 * This class, MetaField, reflects a whole information of binary field
 * Two types of binary field: plain and reference field
 */
export class MetaField {
    /**
     * field id to reference from another field
     */
    public readonly fieldId : string;
    /**
     * fieldLabel is to show field name
     */
    public readonly fieldLabel? : string;
    public readonly fieldDescription? : string;

    public fieldType? : FieldType;
    public valueType : ValueType;
    public valueLengthType? : ValueLengthType;

    public referField : Array<string>;
    private _resolvedReferField : Array<MetaField>;

    private _prevField? : MetaField;

    public arrayEntryField : Array<MetaField>;

    /**
     * a certain field can be specified as the following:
     * value: readonly value
     * offset: offset of another field, default to 0
     * length: length of another field
     */
    private _value? : Buffer;
    private _offset? : number | undefined;
    private _relativeOffset : number | undefined;
    private _length? : number | undefined;
    private _arraysize : number | undefined;
    private _arraylength : number | undefined;
    public baseOffsetField? : MetaField;

    private _actualRawValue? : SourcePos | undefined;

    constructor (id : string, label : string, desc : string,
            field = FieldType.PLAIN, valueType = ValueType.PLAIN) {
        this.fieldId = id;
        this.fieldLabel = label;
        this.fieldDescription = desc;

        this.fieldType = field;
        this.valueType = valueType;

        this.referField = new Array<string>();
        this._resolvedReferField = new Array<MetaField>(ValueType.VALUETYPE_END);

        this.arrayEntryField = new Array<MetaField>();
        this._relativeOffset = 0;
    }

    set value (buf : Buffer) {
        this._value = buf;
    }

    set length (len : number | undefined) {
        this._length = len;
    }

    set relativeOffset (off : number) {
        this._relativeOffset = off;
    }

    set prevField (prev : MetaField | undefined) {
        this._prevField = prev;
    }

    get offset () : number | undefined {
        // if offset is not evaluated yet
        if (this._offset == undefined) {
            // baseOffsetField can be never undefined
            if (this.baseOffsetField != undefined) {
                // if field type is PLAIN
                if (this.baseOffsetField.offset != undefined
                    && this._relativeOffset != undefined) {
                    // offset is specified relatively by a basis of specific field
                    this._offset = this.baseOffsetField.offset + this._relativeOffset;
                }
                else if (this._prevField != undefined
                        && this._prevField.offset != undefined
                        && this._prevField.length != undefined){
                    this._offset = this._prevField.offset + this._prevField.length;
                }
                else {
                    this._offset = 0;
                }
            }
            else {
                // get actual value of specifying this field
                if (this._resolvedReferField[ValueType.OFFSET] != undefined) {
                    const rawVal = this._resolvedReferField[ValueType.OFFSET].rawValue;
                    // if field type is REFERENCE
                    if (rawVal != undefined) {
                        // specify offset field
                        this._offset = BinaryFileLoader.instance.openedFile.readUIntLE(
                                            rawVal.binaryStartPos, (rawVal.length > 6) ? 6 : rawVal.length);
                    }
                }
                else {
                    this._offset = 0;
                }
            }
        }

        return this._offset;
    }

    get length () : number | undefined {
        // if length is not evaluated yet
        if (this._length == undefined) {
            // get actual value of specifying this field
            if (this._resolvedReferField[ValueType.LENGTH] != undefined) {
                const rawVal = this._resolvedReferField[ValueType.LENGTH].rawValue;
                if (rawVal != undefined)
                    // specify length field
                    this._length = BinaryFileLoader.instance.openedFile.readUIntLE(
                                        rawVal.binaryStartPos, (rawVal.length > 6) ? 6 : rawVal.length);
            }
            else if (this.fieldType == FieldType.ARRAY) {
                let arraysize = this.arraySize, arraylength = this.arrayLength;
                if (arraysize != undefined && arraylength != undefined) {
                    this._length = arraysize * arraylength;
                }
            }
        }

        return this._length;
    }

    get arraySize() : number | undefined {
        // if array size is not evaluated yet
        if (this._arraysize == undefined) {
            // get actual value of specifying this field
            if (this._resolvedReferField[ValueType.ARRAYSIZE] != undefined) {
                const rawVal = this._resolvedReferField[ValueType.ARRAYSIZE].rawValue;
                if (rawVal != undefined)
                    // specify length field
                    this._arraysize = BinaryFileLoader.instance.openedFile.readUIntLE(
                        rawVal.binaryStartPos, (rawVal.length > 6) ? 6 : rawVal.length);
            }
        }

        return this._arraysize;
    }

    get arrayLength() : number | undefined {
        // if array size is not evaluated yet
        if (this._arraylength == undefined) {
            // get actual value of specifying this field
            if (this._resolvedReferField[ValueType.ARRAYLENGTH]) {
                const rawVal = this._resolvedReferField[ValueType.ARRAYLENGTH].rawValue;
                if (rawVal != undefined)
                    // specify length field
                    this._arraylength = BinaryFileLoader.instance.openedFile.readUIntLE(
                        rawVal.binaryStartPos, (rawVal.length > 6) ? 6 : rawVal.length);
            }
        }

        return this._arraylength;
    }

    get rawValue() : SourcePos | undefined {
        // offset or length is not evaluated yet
        let offset = this.offset;
        let length = this.length;
        let arraysize, arraylength;

        if (this.fieldType == FieldType.ARRAY) {
            arraysize = this.arraySize;
            arraylength = this.arrayLength;
        }

        // initialize actual value in file
        if (offset != undefined && length != undefined) {
            if (this.fieldType == FieldType.ARRAY
                && arraysize && arraylength) {
                this._actualRawValue = new SourcePos(
                    offset, offset + arraysize*arraylength);
            }
            else {
                this._actualRawValue = new SourcePos(offset, offset + length);
            }
        }
        else
            return undefined;

        return this._actualRawValue;
    }

    public rawEntryValue(index : number) : Array<SourcePos> | undefined {
        let arrayOffset : number;

        if (this.arrayEntryField.length == 0) {
            return undefined;
        }

        if (this.arraySize && this.offset)
            arrayOffset = this.offset + index * this.arraySize;

        return this.arrayEntryField.reduce((prev, curr) => {
            let tmp : SourcePos;
            if (curr.length) {
                tmp = new SourcePos(arrayOffset, arrayOffset + curr.length);
                arrayOffset += curr.length;
                prev.push(tmp);
            }

            return prev;
        }, new Array<SourcePos>());
    }

    get resolvedReferField () {
        return this._resolvedReferField;
    }

    public addReferField(field : MetaField) {
        this._resolvedReferField[field.valueType] = field;
    }
}

// class ArrayMetaField {
//     private _arrayOffset : number;
//     private _entrySize : number;
//     private _entryLength : number;

//     private _arrayField? : Array<MetaField> | undefined;
//     private _elementOffset : number;

//     constructor (offset : number, size : number, length : number) {
//         this._arrayOffset = offset;
//         this._entrySize = size;
//         this._entryLength = length;
//     }

//     public getItem(index : number) : SourcePos {
//     }

//     set arrayField(item : Array<MetaField>) {
//         this._arrayField = item;
//     }

//     get arrayAppliedData() : Array<SourcePos> {
//         return this._arrayField;
//     }
// }

export enum ValueType {
    PLAIN,
    LENGTH,
    OFFSET,
    ARRAYSIZE,
    ARRAYLENGTH,
    TERMINATION,
    VALUETYPE_END
}

const ValueMap : { [ index : string ] : ValueType } = {
    PLAIN : ValueType.PLAIN,
    LENGTH : ValueType.LENGTH,
    OFFSET : ValueType.OFFSET,
    ARRAYSIZE : ValueType.ARRAYSIZE,
    ARRAYLENGTH : ValueType.ARRAYLENGTH,
    TERMINATION : ValueType.TERMINATION
};

export enum FieldType {
    // this field don't have a reference from another field
    // contains only plain hexa-data
    PLAIN = "PLAIN",
    // this field have a reference to another field
    // value could be used to specify offset, length, some countable thing and so on.
    REFERENCE = "REFERENCE",
    ARRAY = "ARRAY"
}

export enum ValueLengthType {
    VARIABLE,
    FIXED,
    TERMINATION,
    UNDEFINED
}
