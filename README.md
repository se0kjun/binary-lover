# binary-lover

This extension shows binary file as hex in vscode. And this extension makes you show and edit binary file conveniently.

## At a glance

## Features

- Show and modify binary file
You can show binary file as hex view in vscode and modify binary data as the following actions:

    1. double click

        When you wanna modify a binary data, double click where you want to modify.

    2. press enter, escape or backspace

        If you press backspace, it would be deleted a binary data. If you press enter or escape, it would be stopped modifying some binary data.
        It will highlight where you modify a binary data.

- Useful commands and meta-viewer to look for a binary data

    It provides some useful commands: go to offset, and will be added more commands.
    Mostly, we show a binary file to find a header information such as magicnumber, data length and so on. The meta-viewer is to show header information in current binary file. A data what the meta-viewer shows is based on the meta file.

- Copy and paste binary data

## Extension Settings

* `numberOfBinaryInLine`: set length to show binary data in a line
* `lazyLoadingSize`: set size to load binary data in once
