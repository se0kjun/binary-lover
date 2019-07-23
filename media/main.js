(function () {
    const vscode = acquireVsCodeApi();
    const dataContainer = document.getElementById('container');
    const loadSize = document.getElementById('loadOffset').getAttribute('data-load-size');
    let loadLock = false;
    let loadedOffset = document.getElementById('loadOffset').getAttribute('data-load-offset');
    let gotoElem = undefined;
    let selectedElemValue = 0;
    let editableElement;
    let focusHexElem = undefined;

    window.addEventListener('load', function(e) {
        vscode.postMessage({
            command : 'restoreCheck'
        });
    });

    window.addEventListener('scroll', function(ev) {
        if (window.scrollY / (dataContainer.scrollHeight - window.innerHeight) > 0.9
            && !loadLock) {
            vscode.postMessage({
                command : 'lazyLoad'
            });
            loadLock = true;
        }
    });

    window.addEventListener('message', function(ev) {
        const message = event.data;
        switch (message.command) {
            case 'onload':
                dataContainer.innerHTML += message.lazyHTML;
                loadedOffset = message.loadedOffset;
                loadLock = false;
                break;
            case 'gotoOffset':
                let inputOffset = message.offset;
                if (gotoElem != undefined) {
                    gotoElem.setAttribute('class', 'hex-data');
                }
                if (loadedOffset < inputOffset) {
                    const tmp = Math.ceil((inputOffset - loadedOffset) / loadSize);
                    vscode.postMessage({
                        command : 'lazyLoad',
                        loadEnd : loadSize * tmp,
                        gotoOffset : inputOffset
                    });

                    loadLock = true;
                } else {
                    gotoElem = this.document.querySelector(`span[offset='${inputOffset}']`);
                    gotoElem.scrollIntoView();
                    gotoElem.setAttribute('class', 'hex-data selection-goto');
                }
                break;
            case 'gotoOffsetAfterLoad':
                dataContainer.innerHTML += message.lazyHTML;
                loadedOffset = message.loadedOffset;

                let offsetAfterLoad = message.gotoOffset;
                gotoElem = this.document.querySelector(`span[offset='${offsetAfterLoad}']`);
                gotoElem.scrollIntoView();
                gotoElem.setAttribute('class', 'hex-data selection-goto');
                loadLock = false;
                break;
            case 'restore':
                let removedItems = message.removed;
                let modifiedItems = message.modified;

                removedItems.forEach(function(item) {
                    let removedItem = this.document.querySelector(`span[offset='${item}']`);
                    removedItem.classList.add('removed_data');
                    removedItem.classList.add('modified');
                    removedItem.innerHTML = "  ";
                });
                modifiedItems.forEach(function(item) {
                    let modifiedItem = this.document.querySelector(`span[offset='${item.offset}']`);
                    modifiedItem.classList.add('modified');
                    modifiedItem.innerHTML = item.data;
                });
                break;
        }
    });

    document.addEventListener('click', function(e) {
        if (e.srcElement.classList.contains('hex_data')) {
            if (focusHexElem) {
                focusHexElem.classList.remove('focus-hex');
            }

            focusHexElem = e.srcElement;
            e.srcElement.classList.add('focus-hex');
        }
    });

    Array.from(document.getElementsByClassName('field-description')).forEach(function(elem) {
        elem.addEventListener('click', function(e) {
            let collapseElem = e.srcElement.nextElementSibling;
            if (collapseElem.classList.contains('collapse')) {
                collapseElem.classList.remove('collapse');
            } else {
                collapseElem.classList.add('collapse');
            }
        });
    });

    document.getElementById('bin-save').addEventListener('click', function(e) {
        vscode.postMessage({
            command : 'save'
        });
    });

    document.getElementById('bin-saveas').addEventListener('click', function(e) {
        vscode.postMessage({
            command : 'saveas'
        });
    });

    document.addEventListener('copy', function(e) {
        var selObj = window.getSelection();
        if (selObj.rangeCount) {
            var copyElem = selObj.getRangeAt(0).cloneContents();
            var data = "";
            copyElem.querySelectorAll('.hex_data').forEach(value => {
                data += (value.textContent.trim() + " ");
            });
            e.clipboardData.setData('text/plain', data);
            e.preventDefault();
        }
    });

    document.addEventListener('dblclick', function(mouse) {
        if (editableElement != undefined) {
            editableElement.innerText = editableElement.firstElementChild.value;
        }

        let mouseTarget = mouse.srcElement;
        if (mouseTarget.classList.contains('hex_data')) {
            let value = mouseTarget.innerText;
            selectedElemValue = value;
            mouseTarget.innerHTML = `<input class="edit-bin" type="text" value="${value.trim()}" maxlength="2">`;
            editableElement = mouseTarget;
            focusToEnd(mouseTarget.firstElementChild);
        }
    });

    document.addEventListener('keydown', function(e) {
        let selObj = window.getSelection();
        // if keydown event is triggered by edit-bin, input box
        if (e.srcElement.classList.contains('edit-bin')) {
            let value = String(e.srcElement.value);
            editableElement = e.srcElement.parentNode;
            // press escape or enter key
            if (e.key == 'Escape' || e.key == 'Enter') {
                // if a length of value is two, it would deal with a valid value
                if (value.length == 2) {
                    // check if previous value and current value is same
                    if (selectedElemValue != value) {
                        // value has been changed
                        notifyModification(e.srcElement.parentNode, value, false);
                        e.srcElement.parentNode.setAttribute('class', 'hex_data modified');
                    }

                    e.srcElement.outerHTML = value.trim().toUpperCase();
                    editableElement = undefined;
                }
                // if a length of value is zero, it would deal with a blank
                else if (value.length == 0) {
                    notifyModification(e.srcElement.parentNode, undefined, true);
                    e.srcElement.parentNode.setAttribute('class', 'hex_data removed_data modified');
                    e.srcElement.outerHTML = "  ";
                    editableElement = undefined;
                }
            }
            // press backspace
            else if (e.key == 'Backspace') {
                // if it has no value
                if (value.length == 0) {
                    // find previous sibling and check if classlist contains hex_data.
                    // if cursor has been focused the first binary data in a line,
                    // it will be moved to the last binary data in a former line.
                    let prevSibling = e.srcElement.parentNode.previousElementSibling;
                    if (!prevSibling) {
                        prevSibling = e.srcElement.closest('.bin-wrapper').previousElementSibling;
                        if (prevSibling) {
                            let child = prevSibling.getElementsByClassName('hex_data');
                            prevSibling = child[child.length - 1];
                        }
                    }

                    // current element will be marked as the removed data.
                    // prevSibling creates inputbox
                    if (prevSibling != null) {
                        let prevSiblingValue = prevSibling.innerText;
                        notifyModification(e.srcElement.parentNode, prevSiblingValue, true);
                        e.srcElement.parentNode.setAttribute('class', 'hex_data removed_data modified');
                        e.srcElement.outerHTML = "  ";
                        prevSibling.innerHTML = `<input class="edit-bin" type="text" value="${prevSiblingValue.trim()}" maxlength="2">`;
                        focusToEnd(prevSibling.firstElementChild);
                    }
                }
            }
            // press characters or numbers
            else if ((e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 65 && e.keyCode <= 90)) {
                // if a length of value is two, it would move a cursor to the next element sibling
                if (value.length == 2) {
                    // find next sibling
                    // if cursor has been focused the last binary data in a line,
                    // it will be moved to the first binary data in a latter line.
                    let nextSibling = e.srcElement.parentNode.nextElementSibling;
                    if (!nextSibling) {
                        nextSibling = e.srcElement.closest('.bin-wrapper').nextElementSibling;
                        if (nextSibling) {
                            let child = nextSibling.getElementsByClassName('hex_data');
                            nextSibling = child[0];
                        }
                    }

                    // current element will be marked as the modified data.
                    if (nextSibling != null) {
                        notifyModification(e.srcElement.parentNode, value, false);
                        e.srcElement.parentNode.setAttribute('class', 'hex_data modified');
                        e.srcElement.outerHTML = value.trim().toUpperCase();
                        nextSibling.innerHTML = `<input class="edit-bin" type="text" maxlength="2">`;
                        focusToEnd(nextSibling.firstElementChild);
                    }
                }
            } else {
                e.preventDefault();
            }
        }
        // selection and press backspace
        else if (selObj.rangeCount && e.key == 'Backspace') {
            let rangeObj = selObj.getRangeAt(0);
            let removeElem = rangeObj.commonAncestorContainer;
            // find an element contains hex_data in class,
            // it will be marked as the removed data
            removeElem.querySelectorAll('.hex_data').forEach(value => {
                if (rangeObj.intersectsNode(value)) {
                    notifyModification(value, undefined, true);
                    value.innerHTML = "  ";
                    value.setAttribute('class', 'hex_data removed_data modified');
                }
            });
        }
    });

    function focusToEnd(el) {
        el.focus();
        el.setSelectionRange(2, 2);
    }

    // if flag is true, it has been removed, if not, it has been modified
    function notifyModification(el, data, flag) {
        let offset = el.getAttribute('offset');
        let sendData;
        if (data != undefined) {
            sendData = data.trim().toUpperCase();
        }

        if (flag) {
            vscode.postMessage({
                command : 'removed',
                offset : offset,
            });
        } else {
            vscode.postMessage({
                command : 'modified',
                offset : offset,
                data : sendData
            });
        }
    }
}());
