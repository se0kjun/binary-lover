(function () {
    const vscode = acquireVsCodeApi();
    const oldState = vscode.getState();
    const dataContainer = document.getElementById('container');
    const loadSize = document.getElementById('loadOffset').getAttribute('data-load-size');
    let loadLock = false;
    let loadedOffset = document.getElementById('loadOffset').getAttribute('data-load-offset');
    let gotoElem = undefined;
    let selectedElemValue = 0;
    let editableElement;

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
            let value = editableElement.firstElementChild.value;
            editableElement.innerHTML = value;
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
        if (e.srcElement.classList.contains('edit-bin')) {
            let value = String(e.srcElement.value);
            if (e.key == 'Escape' || e.key == 'Enter') {
                if (value.length == 2) {
                    if (selectedElemValue != value) {
                        e.srcElement.parentNode.setAttribute('class', 'hex_data modified');
                    }

                    e.srcElement.outerHTML = value.trim().toUpperCase();
                } else if (value.length == 0) {
                    e.srcElement.parentNode.setAttribute('class', 'hex_data removed_data modified');
                    e.srcElement.outerHTML = "  ";
                }
            }
            else if (e.key == 'Backspace') {
                if (value.length == 0) {
                    let prevSibling = e.srcElement.parentNode.previousElementSibling;
                    if (!prevSibling.classList.contains('hex_data')) {
                        if (prevSibling.parentNode.previousElementSibling != null) {
                            for (let child of prevSibling.parentNode.previousElementSibling.children) {
                                if (child.classList.contains('hex_data'))
                                    prevSibling = child;
                            }
                        } else {
                            prevSibling = null;
                        }
                    }

                    if (prevSibling != null) {
                        let prevSiblingValue = prevSibling.innerText;
                        e.srcElement.parentNode.setAttribute('class', 'hex_data removed_data modified');
                        e.srcElement.outerHTML = "  ";
                        prevSibling.innerHTML = `<input class="edit-bin" type="text" value="${prevSiblingValue.trim()}" maxlength="2">`;
                        focusToEnd(prevSibling.firstElementChild);
                    }
                }
            }
            else if ((e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 65 && e.keyCode <= 90)) {
                if (value.length == 2) {
                    let nextSibling = e.srcElement.parentNode.nextElementSibling;
                    if (!nextSibling.classList.contains('hex_data')) {
                        if (nextSibling.parentNode.nextElementSibling != null) {
                            for (let child of nextSibling.parentNode.nextElementSibling.children) {
                                if (child.classList.contains('hex_data')) {
                                    nextSibling = child;
                                    break;
                                }
                            }
                        } else {
                            nextSibling = null;
                        }
                    }

                    if (nextSibling != null) {
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
        else if (selObj.rangeCount && e.key == 'Backspace') {
            let rangeObj = selObj.getRangeAt(0);
            let removeElem = rangeObj.commonAncestorContainer;
            removeElem.querySelectorAll('.hex_data').forEach(value => {
                if (rangeObj.intersectsNode(value)) {
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
}());
