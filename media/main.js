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
}());
