(function () {
    const vscode = acquireVsCodeApi();
    const oldState = vscode.getState();
    const dataContainer = document.getElementById('container');
    const loadSize = document.getElementById('loadOffset').getAttribute('data-load-size');
    let loadLock = false;
    let loadedOffset = document.getElementById('loadOffset').getAttribute('data-load-offset');
    let gotoElem = undefined;

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

    document.addEventListener('copy', function(e) {
        var selObj = window.getSelection();
        if (selObj.rangeCount) {
            var copyElem = selObj.getRangeAt(0).cloneContents();
            var data = "";
            copyElem.querySelectorAll('.hex_data').forEach(value => {
                data += value.textContent.trimLeft();
            });
            e.clipboardData.setData('text/plain', data);
            e.preventDefault();
        }
    });

    document.addEventListener('dblclick', function(mouse) {
        let mouseTarget = mouse.srcElement;
        if (mouseTarget.classList.contains('hex_data')) {
            let value = mouseTarget.innerText;
            mouseTarget.innerHTML = `<input class="edit-bin" type="text" value="${value.trim()}" maxlength="2">`;
            focusToEnd(mouseTarget.firstElementChild);
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.srcElement.classList.contains('edit-bin')) {
            let value = String(e.srcElement.value);
            if (e.key == 'Escape') {
                if (value.length == 2) {
                    e.srcElement.outerHTML = value.trim();
                } else if (value.length == 0) {
                    e.srcElement.parentNode.setAttribute('class', 'hex_data removed_data modified');
                    e.srcElement.outerHTML = "  ";
                }
            }
            else if (e.key == 'Backspace') {
                if (value.length == 0) {
                    let prevSibling = e.srcElement.parentNode.previousElementSibling;
                    let prevSiblingValue = prevSibling.innerText;
                    e.srcElement.parentNode.setAttribute('class', 'hex_data removed_data modified');
                    e.srcElement.outerHTML = "  ";
                    prevSibling.innerHTML = `<input class="edit-bin" type="text" value="${prevSiblingValue.trim()}" maxlength="2">`;
                    focusToEnd(prevSibling.firstElementChild);
                    // TODO: traversing prev sibling when cursor is the first pos in a line
                }
            }
            else if ((e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 65 && e.keyCode <= 90)) {
                if (value.length == 2) {
                    let nextSibling = e.srcElement.parentNode.nextElementSibling;
                    if (nextSibling != null) {
                        e.srcElement.parentNode.setAttribute('class', 'hex_data modified');
                        e.srcElement.outerHTML = value.trim();
                        nextSibling.innerHTML = `<input class="edit-bin" type="text" maxlength="2">`;
                        focusToEnd(nextSibling.firstElementChild);
                    }
                }
            } else {
                e.preventDefault();
            }
        }
    });

    function focusToEnd(el) {
        el.focus();
        el.setSelectionRange(2, 2);
    }
}());
