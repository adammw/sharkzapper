/*
 * sharkzapper_contentscript.js
 * This is the content script for sharkZapper which works on Grooveshark's website to inject our listener
 *
 * sharkZapper is Copyright (C) 2010-2011 Adam Malcontenti-Wilson <adman.com@gmail.com>
 * You are hereby granted a licence to use the software as-is, and view the source code for educational purposes.
 * You may not create derivative versions of the software without written permission of the author.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; 
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * 
 * Grooveshark imagery and related media is Copyright (C) Escape Media Group. 
 * "Grooveshark" and Grooveshark Logos are trademarks of Escape Media Group.
 */
/* constants (but don't use const as they may be redefined by newer injection) */
var debug = true;
var thisVersion = '1.4.0-beta1';
/* global variables */
var recieveMessage, sendRequest, inject, tabnavListener;
var injected = false;
/* functions */
function inject_sharkzapper() {
    if(debug) console.log("fetching injection script, sharkzapper version "+thisVersion);
    sendRequest({"command": "getTabCount"});
    sendRequest({"command": "fetchInject"});

    function receiveMessage(e) {
        if (e.origin != "http://preview.grooveshark.com" && e.origin != "http://grooveshark.com") return;
	    var request = JSON.parse(e.data);
        if (debug) console.log('sharkzapper:', '<(M)C<', request);
	    switch (request.command) {
		    case 'contentScriptInit':
		    case 'statusUpdate':
            case 'settingsUpdate':
		    case 'firstTabNavigate':
            case 'notification':
            case 'interactionTimePrompt':
            case 'fetchView':
            case 'fetchSettings':
			    sendRequest(request);
                break;
            case 'removeListener':
                window.removeEventListener("message",receiveMessage,false);
                window.removeEventListener("close",handleClose,false);
                chrome.extension.onRequest.removeListener(recieveRequest);
                receiveMessage = function(e){ console.error('got messages from dead function',e); };
                receiveRequest = function(e){ console.error('got requests from dead function',e); };
                if (request.injectNew) {
                    if (debug) console.log("cleanup stage2 done! attempting to inject new sharkzapper (not done by us - sending message)");
                } else {
                    if (debug) console.log("cleanup stage2 done! leaving.");
                }
                sendMessage({"command":"cleanupDone","injectNew":request.injectNew});
                sendRequest({"command":"cleanupDone","injectNew":request.injectNew});
                break;
	    }
    }

    function sendMessage(message) {
        if (debug) console.log('sharkzapper:', '>(M)C>', message);
        window.postMessage(JSON.stringify(message), location.origin);
    }

    function recieveRequest(request, sender, sendResponse) {
        if (debug) console.log('sharkzapper:', '<(R)C<', request, sender);
        //if (request.source != "page") return;
	    switch (request.command) {
		    case 'prevSong':
		    case 'pauseSong':
		    case 'playSong':
		    case 'resumeSong':
		    case 'nextSong':
		    case 'updateStatus':
		    case 'toggleMute':
            case 'togglePlayPause':
		    case 'performSearch':
		    case 'addToLibrary':
		    case 'removeFromLibrary':
		    case 'addToSongFavorites':
		    case 'removeFromSongFavorites':
            case 'toggleSmile':
            case 'toggleFrown':
            case 'interactionTimeResume':
            case 'settingsUpdate':
            case 'viewUpdate':
            case 'volumeUpdate':
            case 'setShuffle':
            case 'setCrossfadeEnabled':
            case 'setRepeat':
            case 'mobileBinded':
            case 'mobileUnbinded':
			    sendMessage(request);
			    break;
		    case 'tabCount':
			    if (debug) console.log('There are ' + request.tabCount + ' open grooveshark tabs!');
			    if (request.tabCount != 1) {
				    if (!document.getElementById('sharkzapper_warning_bar')) {
					    warn = document.createElement('div');
					    warn.id = 'sharkzapper_warning_bar';
					    warn.innerHTML = '<div style="position: absolute; top: 0px; z-index: 100000; color: black; width: 100%; text-align: center; font-size: 120%; padding: 12px; background-color: rgba(255, 255, 224, 0.8); ">Grooveshark is already open in <a href="http://grooveshark.com/" onclick="window.postMessage(JSON.stringify({\'command\':\'firstTabNavigate\'}), location.origin); ">another tab</a>, please close this tab if you wish to use SharkZapper. <span style="float:right; margin-right: 24px;"><a href="#/" onclick="document.body.removeChild(document.getElementById(\'sharkzapper_warning_bar\'));">close</a></span></div>';
					    document.body.appendChild(warn);
                        window.addEventListener("message", tabnavListener, false);  // listen for "firstTabNavigate" message 
                                                                                    // can't rely on normal listener as it will be cleaned up by clean_up()
				    }
				    if (document.getElementById('sharkzapperInject')) { clean_up(); }
			    }
			    break;
		    case 'injectScript':
                inject = document.createElement('script');
                inject.id = 'sharkzapperInject'; 
                inject.className = 'version_'+thisVersion;
                inject.innerHTML = request.script;
                if(debug) console.log("injecting sharkzapper version "+thisVersion, inject);
                try {
                    document.body.appendChild(inject);
                } catch (e) {
                    console.error('sharkzapper:', e);
                }
                break;
	    }
    }

    function sendRequest(request) {
        if (!request.source) request.source = "contentscript";
        if (debug) console.log('sharkzapper:', '>(R)C>', request);
        chrome.extension.sendRequest(request);
    }

    function handleClose() {
        sendRequest({"command":"gsTabClosing"});
    }

    window.addEventListener("message", receiveMessage, false);
    window.addEventListener("unload", handleClose, false);    

    chrome.extension.onRequest.addListener(recieveRequest);
}
function clean_up(injectNew) {
    if (debug) console.log('running cleanup with injectNew:', injectNew);		
    // add listener to run injection when done cleaning up
    window.addEventListener("message", cleanupDoneListener, false); 
    	
	// clean up old injection
	inject = document.getElementById('sharkzapperInject');
	if (!inject) { console.error('could not clean up! dying...'); return;}
	var inject_class = (inject) ? inject.className.split('_') : null;
	// pre-1.4
	if (inject.className == '' || (inject_class.length > 1 && parseFloat(inject_class[1]) < 1.4)) {
        document.body.removeChild(inject);
        cleanup = document.createElement('script');
        cleanup.id = 'sharkzapperCleanUp'; 
        cleanup.className = 'version_'+thisVersion;
        js = 'window.removeEventListener("message",sharkzapper_handle_message,false);';
        if (injectNew) {
            js += 'sharkzapper_post_message({"command":"removeListener","injectNew":true});';
        } else {
            js += 'sharkzapper_post_message({"command":"removeListener","injectNew":false});';
        }
        js += '             $.unsubscribe("gs.notification",sharkzapper_handle_notification);\
				            $.unsubscribe("gs.player.nowplaying",sharkzapper_update_status);\
				            $.unsubscribe("gs.player.queue.change",sharkzapper_update_status);\
				            $.unsubscribe("gs.player.playing.continue",sharkzapper_update_status);\
				            $.unsubscribe("gs.player.paused",sharkzapper_update_status);\
                            $.unsubscribe("gs.auth.song.update",sharkzapper_update_status);\
                            $.unsubscribe("gs.auth.favorites.songs.add",sharkzapper_update_status);\
                            $.unsubscribe("gs.auth.favorites.songs.remove",sharkzapper_update_status);\
                            $.unsubscribe("gs.auth.library.add",sharkzapper_update_status);\
                            $.unsubscribe("gs.auth.library.remove",sharkzapper_update_status);\
                            delete $.View.preCached._gs_views_settings_sharkzapper_ejs;\
                            if (GS.player.playerStatus_) { GS.player.playerStatus = GS.player.playerStatus_; }\
                            if (GS.lightbox.open_) { GS.lightbox.open = GS.lightbox.open_; }\
                            if (GS.Controllers.Page.SettingsController.instance().index_) { GS.Controllers.Page.SettingsController.instance().index = GS.Controllers.Page.SettingsController.instance().index_; }\
                            if (GS.Controllers.Page.SettingsController.instance().loadSettings_) { GS.Controllers.Page.SettingsController.instance().loadSettings = GS.Controllers.Page.SettingsController.instance().loadSettings_; }\
                            document.body.removeChild(document.getElementById("sharkzapperCleanUp"));\
                            if (sharkzapper_debug) console.log("cleanup stage1 done!");';
        cleanup.innerHTML=js;
        document.body.appendChild(cleanup);
    // version 1.4+
    } else {
        window.postMessage(JSON.stringify({"command":"cleanUp"}), location.origin);
        window.postMessage(JSON.stringify({"command":"removeListener", "injectNew": injectNew}), location.origin);
        document.body.removeChild(inject);
    }
    
}
function tabnavListener(e){
    if (e.origin != "http://preview.grooveshark.com" && e.origin != "http://grooveshark.com") return;
    var request = JSON.parse(e.data)
    if (request.command != 'firstTabNavigate') return;
    chrome.extension.sendRequest(request);
    window.removeEventListener("message",tabnavListener,false);
}
function cleanupDoneListener(e){
    if (e.origin != "http://preview.grooveshark.com" && e.origin != "http://grooveshark.com") return;
    var request = JSON.parse(e.data)
    if (request.command != 'cleanupDone') return;
    window.removeEventListener("message",cleanupDoneListener,false);
    if (debug) console.log("got cleanupDone message, inject new:",request.injectNew);
    if (request.injectNew) { inject_sharkzapper(); }
}

/* Main content script */
if (window.location.pathname != "/sidebar.php" && window.location.pathname != "/pixels.php" && window.location.pathname != "/upload/") {
    var inject = document.getElementById('sharkzapperInject');
    // Inject script if newer or in debug mode
    if (inject && (debug || inject.className != 'version_'+thisVersion)) {
        if (debug) console.log('sharkzapper already injected ('+inject.className+'), trying to remove and replace with us! (crosses fingers)');			
        if (inject.className == '') {   //workaround for broken injection behaviour in version 1.2.7 and below
            if (debug) console.log('sharkzapper pre-1.2.7 injected, attempting to workaround broken injection behaviour');
            clean_up(false);
            setTimeout(inject_sharkzapper,500); //hopefully should have cleaned up by 500ms.
        } else {
            clean_up(true);
        }
    } else {
        if (!inject) inject_sharkzapper();
    }
}
