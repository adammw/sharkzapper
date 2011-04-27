/*
 * sharkzapper_background.js
 * This is the background script for sharkZapper which keeps track of settings, tabs and some commands
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
// Global variables
var defaultAlbumArtUrl = 'http://static.a.gs-cdn.net/webincludes/images/default/album_100.png';	
var viewsDir = 'views/';
var socketHost = 'sharkzapper.co.cc';
var socketPort = 8080;
var socketCallbacks = {};
var socketPendingMessages = [];
var socketSequence = 1;
var socketVersion = 1;
var sharkId = 0;
var gsTabs = [];
var gsTabContentScriptLoaded = false;
var backgroundGS = null;
var restoreQueueData = null;
var notifications = [];
var socket = null;
var songNotifications = [];
var debug = false;
var debugStatusUpdate = false;
var pinnedPopup;
var pinnedPopupOpen = false;
var interactionPopup;
var interactionPopupOpen = false;
var lastStatus = {};
var lastSong = {};
var settingsVersion = 9;
var contextMenu = {};
var defaultSettings = {"newTabOnPopupClick": true, "showMuteButton": true, "showQueuePosition": true, "showQueueButtons": true, "showPlaybackButtons": true, "showNotificationOnSongChange": false, "showSearchBox": true, "showVolumeControlOnHover": true, "showAlbumArt": true, "enableSharkzapperMobile": false, "enableBackgroundGrooveshark":false}; 

// Create settings with defaults
if (!localStorage.settings || localStorage.settingsVersion < settingsVersion) {
    if (!localStorage.settings) {
	    localStorage.settings = JSON.stringify(defaultSettings);
	    localStorage.settingsVersion = settingsVersion;
    } else {
        //do upgrade!
        updatedSettings = JSON.parse(localStorage.settings);
        for (key in defaultSettings) {
            if (!updatedSettings[key]) updatedSettings[key] = defaultSettings[key];
        }
        // add specific setting changeovers here
        
        // store changes
        localStorage.settings = JSON.stringify(updatedSettings);
        localStorage.settingsVersion = settingsVersion;
    }
}

function getSetting(settingName) {
    try {
	    if (debug) console.log('setting response',settingName,JSON.parse(localStorage.settings)[settingName]);
	    return JSON.parse(localStorage.settings)[settingName];
    } catch(e) {
	    if (debug) console.log('setting response using default',settingName,JSON.parse(localStorage.settings)[settingName]);
        return defaultSettings[settingName];
    }
}

// Get all open Grooveshark tabs, then call callbacks
function get_gs_tab(success_callback, fail_callback, arg) {
	chrome.windows.getAll({'populate':true}, function(win) {
		gsTabs = [];
		for (wi in win) {
			for (ti in win[wi].tabs) {
 				if(win[wi].tabs[ti].url.indexOf('http://grooveshark.com/')==0) {
					gsTabs.push(win[wi].tabs[ti].id);
 				}
 			}
 		}
		if(gsTabs.length > 0 && typeof success_callback == "function") {
			success_callback(arg);
		} else if(typeof fail_callback == "function") {
			fail_callback(arg);
		} 
 	});
}

// Inject our content scripts into the first grooveshark tab (should not be required after plugin is loaded due to manifest)
function inject_scripts() {
	if (gsTabs.length > 0) {
		chrome.tabs.executeScript(gsTabs[0], {'file':'js/jquery-1.4.4.min.js'});		
		chrome.tabs.executeScript(gsTabs[0], {'file':'js/sharkzapper_contentscript.js'});
		if (debug) console.log('Injected scripts into existing tab #' + gsTabs[0]);
		
		// Add our context menu
		create_contextmenu();
	}
}

// Open a new grooveshark tab or show the currently open one if there is one
function open_gs_tab(url) {
	if (gsTabs.length == 0) {
		if (url) {
			chrome.tabs.create({url:'http://grooveshark.com/' + url});
		} else {
			chrome.tabs.create({url:'http://grooveshark.com/'});
		}
	} else {
	    if (url) {
	        // Ensure that we only update url if it is different
	        chrome.tabs.get(gsTabs[0], function(url){ return function(tab) {
	            if (tab && tab.url == 'http://grooveshark.com/' + url) {
	                chrome.tabs.update(gsTabs[0], {'selected':true});
                } else if (tab && tab.url != 'http://grooveshark.com/' + url) {
                    chrome.tabs.update(gsTabs[0], {'url':'http://grooveshark.com/' + url, 'selected':true});
                } else {
    				chrome.tabs.create({url:'http://grooveshark.com/' + url});
				}
	        }}(url));
		} else {
		    chrome.tabs.update(gsTabs[0], {'selected':true});
		}
	}
}

// Respond to requests
chrome.extension.onRequest.addListener(
	function(request, sender, sendResponse) {
	    // Print requests to the console in debug mode
		if (debug && (debugStatusUpdate || request.command != 'statusUpdate')) console.log("sharkzapper:","<<<",request.command,request);
		
		// Ignore any requests without a command or from ourself
		if (!request.command || request.source == "background") return;
		
		// Pass through cross events (ie. contentscript -> popup, vise-versa)
		if (sender.tab && sender.tab.id == gsTabs[0]) { // Check that only events from the first open tab 
			sendRequest(request,'extension',true);
		} else if (gsTabs.length > 0) {                 // Only send events to the first open tab (if available)
			sendRequest(request,'tab',true);
		}
		
		// Handle commands - note that this is not all the commands, merely ones that the background page needs to do something with
		switch (request.command) {
	        // This is sent each time a popup is open, we give some initialisation settings such as enabled, tabId, etc.
			case 'popupInit':
				if (debug) console.log('Got popup init, re-checking tabs');
				if (backgroundGS) {
				    sendRequest({"command":"popupUpdate","enabled":gsTabContentScriptLoaded,"tabId":gsTabs[0],"pinnedPopupOpen":pinnedPopupOpen,"includeNotification":request.notification},'extension');
				    sendRequest({"command":"updateStatus"},'tab');
				} else {
				    get_gs_tab(function(notification){return function(){ //success (at least one open tab)
					    sendRequest({"command":"popupUpdate","enabled":gsTabContentScriptLoaded,"tabId":gsTabs[0],"pinnedPopupOpen":pinnedPopupOpen,"includeNotification":notification},'extension');
					    sendRequest({"command":"updateStatus"},'tab');
				    };}(request.notification),function(notification){ return function(){ // fail (no open tab)
				        if (getSetting('newTabOnPopupClick')) {
				            open_gs_tab();
					        sendRequest({"command":"popupUpdate","enabled":false,"pinnedPopupOpen":pinnedPopupOpen,"closeImmediately":true,"includeNotification":notification},'extension');
				        } else {
					        sendRequest({"command":"popupUpdate","enabled":false,"pinnedPopupOpen":pinnedPopupOpen,"closeImmediately":false,"includeNotification":notification},'extension');
				        }
				        gsTabContentScriptLoaded = false;
				    };}(request.notification));
			    }
				break;
            
            // This is sent when Grooveshark is closing (or has closed)					
			case 'gsTabClosing':
			    sendRequest({"command":"popupUpdate","enabled":false,"pinnedPopupOpen":pinnedPopupOpen,"closeImmediately":false,"includeNotification":true},'extension');
			    chrome.browserAction.setTitle({"title":"SharkZapper"});
			    gsTabContentScriptLoaded = false;
			    break;
			
			// This is sent from the popup to open the current grooveshark tab or create a new one
			// The url is appended to the end http://grooveshark.com/
			case 'openGSTab':
				get_gs_tab(open_gs_tab,open_gs_tab,request.url);
				break;
				
			// This is sent from a content script to check how many tabs are currently open
			// This message is sent to ALL grooveshark tabs EXCEPT the first, so other tabs can display a warning
			case 'getTabCount':
				get_gs_tab(function(){sendRequest({"command":"tabCount", "tabCount": gsTabs.length},'othertabs')});
				break;
				
			// This is sent from a content script to open the current grooveshark tab AND close the sender's tab
			case 'firstTabNavigate':
				chrome.tabs.remove(sender.tab.id);
				open_gs_tab();
				break;
				
			// This is sent from a content script whenever grooveshark sends a notification
			// Notifications are queued into notifications array, and only display for 5000ms
			case 'notification':
				chrome.tabs.get(gsTabs[0], function(request){ return function(tab){
					if (tab.selected) return; //ignore notifications if tab is open
					if (window.webkitNotifications) {
						notification = window.webkitNotifications.createNotification('','',request.message); 
						notification.ondisplay = function() { setTimeout(function(){ notifications.shift().cancel();}, 5000); };
						notification.show();
						notifications.push(notification);
					}
				}}(request));
				break;
				
			// This is sent from a popup to "pin" the popup by creating a long-living HTML notification
			case 'pinPopup':
			    if (!pinnedPopupOpen && window.webkitNotifications) {
			        pinnedPopup = window.webkitNotifications.createHTMLNotification(chrome.extension.getURL('html/sharkzapper_popup.html#notification'));
			        pinnedPopup.ondisplay = function(){pinnedPopupOpen = true;};
			        pinnedPopup.onclose = function(){pinnedPopupOpen = false;};
			        pinnedPopup.show();
			    }
			    break;
		    
		    // This is sent from a content script many times a second. Most processing for this is done in the popup,
		    // however we also set the title of the browser action to the song / artist name
		    case 'statusUpdate':
		        try {
		        socket_send_update(request);
		        } catch(e) {
		            console.error('socket_send_update',e);
	            }
                lastStatus = request;
                
		        if (lastSong && request.currentSong && request.currentSong.SongName == lastSong.SongName && request.currentSong.ArtistName == lastSong.ArtistName && request.currentSong.AlbumName == lastSong.AlbumName) return;
		        if (request.currentSong && request.currentSong.SongName) {
			        chrome.browserAction.setTitle({"title":request.currentSong.SongName + "\n" + request.currentSong.ArtistName});
			        if (window.webkitNotifications && getSetting("showNotificationOnSongChange")) {
			            for (i in songNotifications) {
			                songNotifications.shift().cancel();
			            }
						notification = window.webkitNotifications.createNotification((request.currentSong.CoverArtFilename) ? request.currentSong.artPath + 'm' + request.currentSong.CoverArtFilename : defaultAlbumArtUrl,request.currentSong.SongName,request.currentSong.ArtistName); 
						notification.ondisplay = function() { setTimeout(function(){ songNotifications.shift().cancel();}, 5000); };
						notification.show();
						songNotifications.push(notification);
					}
		        } else { 
                    chrome.browserAction.setTitle({"title":"sharkZapper"});
                }
                lastSong = request.currentSong;
                break;
                
            // This is sent from a content script when the interactionTime popup appears
            // We then recreate this popup as a notification to ensure the user sees it
            case 'interactionTimePrompt':
                if (!interactionPopupOpen && window.webkitNotifications) {
                    interactionPopup = window.webkitNotifications.createHTMLNotification(chrome.extension.getURL('html/sharkzapper_interactiontime.html'));
                    interactionPopup.ondisplay = function(){interactionPopupOpen = true;};
			        interactionPopup.onclose = function(){interactionPopupOpen = false;};
			        interactionPopup.show();
                }
                break;
                
            // This is sent from the interactionTime notification when the user clicks "Resume"
            case 'interactionTimeResume':
                if (interactionPopupOpen) interactionPopup.cancel();
                break;
                
            // This is sent from a content script when it needs to load a (local) view file
            case 'fetchView':
                if (!request.viewName) { console.error("Cannot fetch view - no viewName specified"); }
                var xhr = new XMLHttpRequest();
                xhr.open("GET",chrome.extension.getURL(viewsDir + request.viewName + '.ejs'));
                xhr.onreadystatechange= function(request){
                    return function() {
                        if (xhr.readyState == 4) {
                            if (xhr.responseText) {
                                response = request;
                                response.command = 'viewUpdate';
                                response.view = xhr.responseText;
                                sendRequest(response, 'tab');
                            } else {XMLHttpRequest
                                console.error("Could not fetch "+viewsDir+request.viewName + '.ejs',xhr);
                            }
                        }
                    }
                }(request);
                xhr.send();
                break;
                
            // This is sent from a content script when it loads - we just send its settings
            case 'contentScriptInit':
                gsTabContentScriptLoaded = true;
                if (!localStorage.settings) return;
                sendRequest({"command":"settingsUpdate","settings":JSON.parse(localStorage.settings)},'tab');
                if (sharkId && socket && socket.connected) {
                    sendRequest({command: 'mobileBinded', sharkId: sharkId}, 'tab');
                }
                if (backgroundGS && restoreQueueData) {
                    setTimeout(function(){
                        restoreQueueData.command = 'restoreQueue';
                        sendRequest(restoreQueueData,'tab');
                    },2000);
                }
                break;
            
            // This is sent to get all the settings
            case 'fetchSettings':
                if (!localStorage.settings) return;
                request.command = "settingsUpdate";
                request.settings = JSON.parse(localStorage.settings);
                sendRequest(request,'tab');
                break;
            
            // This is sent from a content script when it updates settings and we save the settings to localStorage
            case 'settingsUpdate':
                localStorage.settings = JSON.stringify(request.settings);
                if (getSetting('enableSharkzapperMobile') == true) {
                    load_socket();
                } else {
                    kill_socket();
                }
                if (debug) console.log ("Saved Settings!",request.settings);
                break;
                
            case 'transferToBackground':
                restoreQueueData = request;
                create_background_gs();
                break;
                
            // This is sent to get a single setting, and sends the response directly back (requires callback on sender)
            case 'getSetting':
                if (!request.settingName) return;
                sendResponse(getSetting(request.settingName));
                break;
		}
	}
);

// We pass all requests through here so all requests can be easily debugged
function sendRequest(request,dest,dontModifySource) {
    if (!dontModifySource) request.source = "background";
    switch (dest) {
        case 'extension':
            chrome.extension.sendRequest(request); 
			if (debug && (debugStatusUpdate || request.command != 'statusUpdate')) console.log("sharkzapper:",">E>",request.command,request);
			break;
		case 'tab':
		    if (backgroundGS) {
		        backgroundGS.contentWindow.postMessage(JSON.stringify(request),'http://grooveshark.com');
		        console.log('sent to iframe');
		    } else {
		        if (!gsTabs[0]) { return; }
		        chrome.tabs.sendRequest(gsTabs[0], request); 
	        }
			if (debug && (debugStatusUpdate || request.command != 'statusUpdate')) console.log("sharkzapper:",">T>",request.command,request);
			break;
		case 'othertabs': // all tabs except first (active) tab
		    for (i=1;i<gsTabs.length;i++) {
				chrome.tabs.sendRequest(gsTabs[i], request);
			}
			if (debug && (debugStatusUpdate || request.command != 'statusUpdate')) console.log("sharkzapper:",">OTHERT>",request.command, request);
			break;
		case 'alltabs': // all tabs including first (active) tab
		    for (i=0;i<gsTabs.length;i++) {
				chrome.tabs.sendRequest(gsTabs[i], request);
			}
			if (debug && (debugStatusUpdate || request.command != 'statusUpdate')) console.log("sharkzapper:",">ALLT>",request.command, request);
			break;
        default:
            console.error('sendRequest called with unknown destination:',dest);
            break;
    }
}

// simple function to make a callback that sends a request - see popupInit code
function respond_callback(response,dest,dontModifySource) {
	return function(){sendRequest(response,dest,dontModifySource)};
}

function create_contextmenu() {
    if (!contextMenu.prev) contextMenu.prev=chrome.contextMenus.create({title:'Previous Song',contexts:['all'],onclick:contextmenu_callback});
    if (!contextMenu.playPause) contextMenu.playPause=chrome.contextMenus.create({title:'Play/Pause',contexts:['all'],onclick:contextmenu_callback});
    if (!contextMenu.next) contextMenu.next=chrome.contextMenus.create({title:'Next Song',contexts:['all'],onclick:contextmenu_callback});	    
}

function contextmenu_callback(info, tab) {
    var action = null;
    for (key in contextMenu) {
        if (contextMenu[key] == info.menuItemId) {
            action = key;
            break;
        }
    }
    if (debug) console.log("Context menu clicked",action,info,tab);
    do_external_action(action);
}

function do_external_action(action) {
    switch (action) {
        case 'prev':
            sendRequest({command:"prevSong"},'tab');
            break;
        case 'playPause':
            sendRequest({command:"togglePlayPause"},'tab');
            break;
        case 'next':
            sendRequest({command:"nextSong"},'tab');
            break;
    }
}

function create_background_gs() {
    if (backgroundGS != null) { return; }
    backgroundGS = document.createElement('iframe');
    backgroundGS.src = 'http://grooveshark.com';
    document.body.innerHTML = '';
    document.body.appendChild(backgroundGS);
}

function remove_background_gs() {
    document.body.innerHTML = '';
    backgroundGS = null;
}

function load_socketio() {
    var scriptEl = document.createElement('script');
    scriptEl.id = 'socket.io';
    scriptEl.src = '../js/socket.io-0.6.min.js';
    scriptEl.onload = load_socket;
    document.getElementsByTagName('head')[0].appendChild(scriptEl);
}
function kill_socket() {
    if (socket != null) { socket.disconnect(); socket = null;}
}
function load_socket() {
    if (debug) { console.log('socket.io loaded'); }
    if (!window.io) { load_socketio(); return; }
    if (socket != null && (socket.connected || socket.connecting)) { socket.disconnect(); return; }
    socket = new io.Socket(socketHost,{port: socketPort, rememberTransport: false});
    socket.on('message', socket_handle_message)
    socket.on('connect', socket_handle_connect);
    socket.on('connect_failed', socket_handle_connect_failed);
    socket.on('disconnect', socket_handle_disconnect);
    socket.connect();
}
function socket_send_update(status) {
    if (!socket || !socket.connected || socket.connecting) { return; } //ignore when not connected
    if (!status) {
        var params = {currentSong: {}};
        if (lastStatus.hasOwnProperty('isMuted')) params.isMuted = lastStatus.isMuted;
        if (lastStatus.hasOwnProperty('isPaused')) params.isPaused = lastStatus.isPaused;
        if (lastStatus.hasOwnProperty('isPlaying')) params.isPlaying = lastStatus.isPlaying;
        if (lastStatus.hasOwnProperty('shuffle')) params.shuffle = lastStatus.shuffle;
        var paramsSet = false;
        if (lastSong) {
            for (i in lastSong) {
                params.currentSong[i] = lastSong[i];
                paramsSet = true;
            }
        }
        if (!paramsSet) { params.currentSong = null; }
        socket_send_event('statusUpdate',params);
    } else if (status.currentSong) {
        if (status.currentSong != lastSong || lastStatus && (status.isMuted != lastStatus.isMuted || status.isPaused != lastStatus.isPaused || status.isPlaying != lastStatus.isPlaying || status.shuffle != lastStatus.shuffle)) {
            var params = {currentSong: {}};
            var paramsChanged = false;
            if (status.isMuted != lastStatus.isMuted) { params.isMuted = status.isMuted; paramsChanged = true; }
            if (status.isPaused != lastStatus.isPaused) { params.isPaused = status.isPaused; paramsChanged = true;} 
            if (status.isPlaying != lastStatus.isPlaying) { params.isPlaying = status.isPlaying; paramsChanged = true;}
            if (status.shuffle != lastStatus.shuffle) { params.shuffle = status.shuffle; paramsChanged = true;}
            for (i in status.currentSong) {
                //if (typeof status.currentSong[i] == 'object') { continue; }
                if (i == "fanbase") {continue;}
                if (status.currentSong[i] != lastSong[i]) {
                    params.currentSong[i] = status.currentSong[i];
                    paramsChanged = true;
                }
            }
            if (paramsChanged) {
                params.currentSong.CoverArtFilename = status.currentSong['CoverArtFilename'];
                socket_send_event('statusUpdate',params);
            }
        }
    } else {
        socket_send_event('statusUpdate',{currentSong: null, isMuted: status.isMuted, isPaused: status.isPaused, isPlaying: status.isPlaying});
    }
}
function socket_send_event(event, params) {
    if (socket && socket.connected) {
        var message = {event: event, sequence: socketSequence};
        if (params) { message.params = params; }
        if (debug) console.log("sharkzapper:",">S>",message.event, message);
        socket.send(JSON.stringify(message));
        socketSequence++;
    }
}
function socket_send_command(method, params, successCallback, failCallback) {
    if (socket && socket.connected) {
        var message = {method: method};
        var callbacks = {};
        if (params) { message.params = params; }
        if (successCallback && typeof successCallback == 'function') {
            callbacks.success = successCallback;
        }
        if (failCallback && typeof failCallback == 'function') {
            callbacks.fail = successCallback;
        }
        if (callbacks.success || callbacks.fail) {
            message.sequence = socketSequence;
            socketCallbacks[socketSequence] = callbacks;
            socketSequence++;
        }
        if (debug) console.log("sharkzapper:",">S>",message.method, message);
        socket.send(JSON.stringify(message));
    } else if (!socket || !socket.connecting) {
        socketPendingMessages.push({method: method, params: params, successCallback: successCallback, failCallback:failCallback});
        load_socket();
    }
}
function socket_handle_message(data) {
    try {
        var data = JSON.parse(data);
    } catch(e) {
        console.error('Could not parse JSON:',e,data);
        return;
    }
    if (debug) console.log("sharkzapper:","<S<", data);
    if (data.event) {
        switch (data.event) {
            case 'clientConnected':
                socket_send_update();
                break;
            case 'command':
                if (data.params.command) {
                    do_external_action(data.params.command);
                }
                break;
            default:
                console.warn('Unhandled Service Event',data.event);
                break;
        }
    } else if (data.sequence && socketCallbacks[data.sequence] && data.fault && socketCallbacks[data.sequence].fault) {
        socketCallbacks[data.sequence].fault(data.fault);
    } else if (data.sequence && socketCallbacks[data.sequence] && data.result && socketCallbacks[data.sequence].success) {
        socketCallbacks[data.sequence].success(data.result);
    } else if (data.fault) {
        console.warn('Unhandled Service Fault',data.fault);
    } else if (data.result) {
        console.warn('Unhandled Service Result',data.result);
    }
    if (data.sequence && socketCallbacks[data.sequence]) {
        delete socketCallbacks[data.sequence];
    }
}
function socket_handle_connect() {
    if (debug) console.log('socket connected');
    while (socketPendingMessages.length) {
        var pendingMsg = socketPendingMessages.pop();sharkId
        socket_send_command(pendingMsg.method, pendingMsg.params, pendingMsg.successCallback, pendingMsg.failCallback);
    }
    socket_send_command('bindToService',null,function(result) {
        if (result) { sharkId = result; }
        sendRequest({command: 'mobileBinded', sharkId: sharkId}, 'tab');
    });
}
function socket_handle_disconnect() {
    sendRequest({command: 'mobileUnbinded'}, 'tab');
    socket = null;
}
function socket_handle_connect_failed(e) {
    console.error('Socket connect failed',e);
}

// Inject all currently open tabs with our content script
get_gs_tab(inject_scripts); 

// Open socket connection if sharkzapperMobile is enabled
if (getSetting('enableSharkzapperMobile') == true) {
    load_socket();
}
