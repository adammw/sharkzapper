![sharkZapper Logo](https://raw.github.com/adammw/sharkzapper/master/data/img/icon_128.png)
sharkZapper 
===========

an unoffical browser extension to control Grooveshark
-----------------------------------------------------

### Introduction

sharkZapper started as a quickly made extension for Chrome to control Grooveshark HTML5/Javascript interface in a way that was previously not possible due to the flash interface. 
It was released for free to the Chrome Web Store and lives at: https://chrome.google.com/webstore/detail/dcaneijaapiiojfmgmdjeapgpapbjohb

### Supported Browsers

Currently sharkZapper only supports Google Chrome/Chromium browsers, however there was some progress to also support Firefox and Safari. Firefox and Safari-related files may be present or visible in the source repository but please note that at the moment it is completely untested, unstable and incomplete. 

### Bug Reports and Feature Requests

Please submit any bug reports and feature requests to the Issues tab on GitHub. If you do not have a GitHub account, email me at adman.com@gmail.com to post on your behalf. I cannot guarantee that every issue will be fixed or implemented. Patches are also welcome, preferably as Pull Requests.

### File Structure
Due to the multi-platform compatible nature of sharkZapper, the file/folder structure is odd and as follows:

    /                               Root Directory - contains README, LICENSE and JSON extension descriptors
    /manifest.json                  Extension JSON Descriptor for Google Chrome / Chromium
    /package.json                   Extension JSON Descriptor for Mozilla Firefox
    /data/                          Firefox "Data" Directory
        /css/                       Contains all CSS files
        /fonts/                     Contains all custom font files
        /html/                      Contains all HTML files
        /img/                       Contains all image files, including logos
        /js/                        Contains JS for popups, options pages and injection into Grooveshark DOM
        /views/                     Contains all EJS views for Grooveshark (no longer used)
    /lib/                           Firefox "Lib" Directory
        main.js                     Firefox main.js - runs the background script and sets up the browser
        sharkzapper_background.js   Background script shared between Chrome/Firefox     


### License and Copyrights

See the LICENSE file for the most-up-to-date version. Note that this license is not strictly open source, in that **you can not do what ever you want with it**.

Grooveshark imagery and related media is Copyright (C) Escape Media Group. 
"Grooveshark" and Grooveshark Logos are trademarks of Escape Media Group.

