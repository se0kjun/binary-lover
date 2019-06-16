(function () {
    const vscode = acquireVsCodeApi();
    const oldState = vscode.getState();
    const dataContainer = document.getElementById('container');
    let loadLock = false;

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
                loadLock = false;
                break;
        }
    });
}());
