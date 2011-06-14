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
 //TODO: Hook into status updates and set extension title on currently playing song, show notifications on song change, etc.
/**
 * Creates main sharkzapper background object
 *
 * @this {SharkZapperBackground}
 * @version 1.4.0
 * @param {Boolean} debug
 */
var sharkzapper = new (function SharkZapperBackground(debug){
	var sharkzapper = this;
	sharkzapper.version = '1.4.0-beta2';
    
    sharkzapper.setDebugLevel = function(l) {
        debug = 1; // Always debug sending out setDebugLevel
        sharkzapper.message.send({"command": "setDebugLevel", "level": l}, 'allports');
        debug = l;
        return debug;
    }
	
	/**
	 * @constructor
	 */
	function SharkZapperPort(port) {
		for (i in port) {
			if (!port.hasOwnProperty(i)) continue;
			this[i] = port[i];
		}
	}
	SharkZapperPort.prototype = chrome.Port.prototype;
	SharkZapperPort.prototype.send = function(data) {
		if(debug) console.log("sharkzapper:",">PORT:"+this.name+">",data.command, data);
		this.postMessage(data);
	};
	SharkZapperPort.prototype.disconnect_ = SharkZapperPort.prototype.disconnect;
	SharkZapperPort.prototype.disconnect = function() {
		if(debug) console.warn("disconnecting "+this.name+" port");
		this.disconnect_();
	};
	
	
	/* Settings Namespace */
	sharkzapper.settings = {
		version: 9,
		defaults: {
			"newTabOnPopupClick": true,
			"showContextMenu": true,
			"showMuteButton": true,
			"showQueuePosition": true,
			"showQueueButtons": true,
			"showPlaybackButtons": true,
			"showNotificationOnSongChange": false,
			"showSearchBox": true,
			"showVolumeControlOnHover": true,
			"showAlbumArt": true,
			"enableSharkzapperMobile": false
		},
		
		/**
		 * Checks if settings are present or need upgrading to latest version
		 */
		upgrade: function upgrade_settings() {
			// Create settings with defaults
			if (!localStorage.settings || localStorage.settingsVersion < sharkzapper.settings.version) {
				if (!localStorage.settings) {
					localStorage.settings = JSON.stringify(sharkzapper.settings.defaults);
					localStorage.settingsVersion = sharkzapper.settings.version;
				} else {
					//do upgrade!
					var updatedSettings = JSON.parse(localStorage.settings);
					for (key in sharkzapper.settings.defaults) {
						if (!updatedSettings[key]) updatedSettings[key] = sharkzapper.settings.defaults[key];
					}
					// add specific setting changeovers here
					
					// store changes
					localStorage.settings = JSON.stringify(updatedSettings);
					localStorage.settingsVersion = sharkzapper.settings.version;
				}
			}
		},
		/**
		 * Fetches all settings
		 */
		fetchAll: function fetch_all_settings() {
			sharkzapper.settings.upgrade();
			return JSON.parse(localStorage.settings);
		},
		/**
		 * Fetches a single setting 
		 * @param {string} settingName
		 */
		fetch: function fetch_setting(settingName) {
			try {
				return JSON.parse(localStorage.settings)[settingName];
			} catch(e) {
				return defaultSettings[settingName];
			}
		},
		/**
		 * Stores new settings
		 * @param {Object} settings
		 */
		update: function update_settings(settings) {
			localStorage.settings = JSON.stringify(settings);
			
			if (settings.showContextMenu) {
				sharkzapper.contextMenu.create();
			} else {
				sharkzapper.contextMenu.destroy();
			}
		}
	};
	
	/* Listeners Namespace */
	sharkzapper.listeners = {
		bind: function bind_listeners() {
			chrome.extension.onRequest.addListener(sharkzapper.listeners.request);
			chrome.extension.onConnect.addListener(sharkzapper.listeners.connect);
		},
		unbind: function unbind_listeners() {
			chrome.extension.onRequest.removeListener(sharkzapper.listeners.request);
			chrome.extension.onConnect.removeListener(sharkzapper.listeners.connect);
		},
		//TODO: error handlers
		request: function handle_request(request, sender, sendResponse) {
            sharkzapper.message.recieve(request, sender, sendResponse);
        },
		connect: function handle_connect(port) {
			sharkzapper.message.connect(new SharkZapperPort(port));
		}
	};
	
	/* Message Namespace */
	sharkzapper.message = {
		ports: {
			popup: []
		},
		/** 
		 * Called when a Port is connected
		 * @param {SharkZapperPort} port
		 */
		connect: function(port) {
			if(debug) console.log("port",port.name,"connected",port);
			switch(port.name) {
				case 'contentScript':
					if (sharkzapper.message.ports.contentScript) {
						port.send({command: "cleanUp", showTabWarning: true});
						port.disconnect();
					} else {
						sharkzapper.message.ports.contentScript = port;
						port.send({command: "contentScriptUpdate", version: sharkzapper.version});
						sharkzapper.resources.fetch('js/sharkzapper_inject.js', function(script) {
							port.send({command: "injectScript", script: script});
						});
						port.onMessage.addListener((function create_port_listener (port) {
							return function port_listener(msg){
								sharkzapper.listeners.request(msg, {port: port});
							}
						})(port));
						port.onDisconnect.addListener(function disconnect_listener() {
							if(debug) console.warn('port',port.name,'disconnected',port);
							sharkzapper.message.ports.contentScript = null;
							chrome.browserAction.setTitle({"title":"sharkZapper"});
							if (sharkzapper.contextMenu.handles.curSong) 
								chrome.contextMenus.update(sharkzapper.contextMenu.handles.curSong, {title: 'Open Grooveshark'});
						});
					}
					break;
				case 'settings':
					//TODO
				case 'popup':
					sharkzapper.message.ports.popup.push(port);
					port.send({command: "settingsUpdate", settings: sharkzapper.settings.fetchAll()});
					port.send({command: "popupUpdate", pinnedPopupOpen: sharkzapper.popup.pinnedPopupOpen});

					port.onMessage.addListener((function create_port_listener (port) {
						return function port_listener(msg){
							sharkzapper.listeners.request(msg, {port: port});
						}
					})(port));
					port.onDisconnect.addListener(function disconnect_listener() {
						if(debug) console.warn('port',port.name,'disconnected',port);
						sharkzapper.message.ports.popup.splice(sharkzapper.message.ports.popup.indexOf(port),1);
					});
					if (sharkzapper.message.ports.contentScript) {
						sharkzapper.message.ports.contentScript.send({command: "updateStatus"});
					} else {
						//TODO: tab not open, open tab if setting set
					}
					break;
				default:
					console.warn("Unhandled port: ", port.name, port);
					port.disconnect();
					break;
			}
		},
		/**
		 * Send a request
		 *
		 * @param request: data to be sent
		 * @param dest: destination
		 */
		send: function message_send(request, dest) {
            //TODO: rewrite and clean up (but remember to test old things like external commands)
			if (sharkzapper.message.ports.hasOwnProperty(dest)) {
				if (debug && (debug > 1 || request.command != 'statusUpdate')) console.log("sharkzapper:",">PORT:" +sharkzapper.message.ports[dest].name +">",request.command, request);
				if (sharkzapper.message.ports[dest] instanceof Array) {
					for (i=0;i<sharkzapper.message.ports[dest].length;i++) {
						sharkzapper.message.ports[dest][i].postMessage(request);
					}
				} else {
					sharkzapper.message.ports[dest].postMessage(request);
				}
				return;
			} 
            
			switch (dest) {
				case 'extension':
					chrome.extension.sendRequest(request); 
					if (debug && (debug > 1 || request.command != 'statusUpdate')) console.log("sharkzapper:",">E>",request.command,request);
					break;
				case 'tab':
					chrome.tabs.sendRequest(sharkzapper.tabs.openTabIds[0], request); 
					if (debug && (debug > 1 || request.command != 'statusUpdate')) console.log("sharkzapper:",">T>",request.command,request);
					break;
				case 'othertabs': // all tabs except first (active) tab
					for (i=1;i<sharkzapper.tabs.openTabIds.length;i++) {
						chrome.tabs.sendRequest(sharkzapper.tabs.openTabIds[i], request);
					}
					if (debug && (debug > 1 || request.command != 'statusUpdate')) console.log("sharkzapper:",">OTHERT>",request.command, request);
					break;
				case 'alltabs': // all tabs including first (active) tab
					for (i=0;i<sharkzapper.tabs.openTabIds.length;i++) {
						chrome.tabs.sendRequest(sharkzapper.tabs.openTabIds[i], request);
					}
					if (debug && (debug > 1 || request.command != 'statusUpdate')) console.log("sharkzapper:",">ALLT>",request.command, request);
					break;
                case 'allports':
                    for (var dest in sharkzapper.message.ports) {
                        if (debug && (debug > 1 || request.command != 'statusUpdate')) console.log("sharkzapper:",">PORT:" +sharkzapper.message.ports[dest].name +">",request.command, request);
                        if (sharkzapper.message.ports[dest] instanceof Array) {
                            for (i=0;i<sharkzapper.message.ports[dest].length;i++) {
                                sharkzapper.message.ports[dest][i].postMessage(request);
                            }
                        } else {
                            sharkzapper.message.ports[dest].postMessage(request);
                        }
                    }
                    break;
				default:
					console.error('sendRequest called with unknown destination:',dest);
					break;
			}
		},
		recieve: function message_recieve(request, sender) {
			// Determine sender
			var senderName = (sender.tab && sender.tab.id) ? 'TAB:'+sender.tab.id : (sender.id && !sender.tab) ? 'EXTENSION' : (sender.port) ? 'PORT:'+sender.port.name : 'UNK';
			sendResponse = function unknown_sender(msg) { console.error('Could not send response, unknown sender', msg); };
			if (sender && sender.port) {
				sendResponse = function respond_to_port(msg) { 
					if (debug) console.log("sharkzapper:",">PORT:" + sender.port.name + ">",request.command,request);
					sender.port.postMessage(msg); 
				}
			} else if (sender && sender.tab && sender.tab.id) {
				sendResponse = function respond_to_tab(msg) {
					if (debug) console.log("sharkzapper:",">TAB:" + sender.tab.id + ">",request.command,request);
					chrome.tabs.sendRequest(sender.tab.id, msg);
				}
			} else if (sender && sender.id && !sender.tab) {
				sendResponse = function respond_to_extension(msg) {
					if (debug) console.log("sharkzapper:",">EXTENSION>",request.command,request);
					chrome.extension.sendRequest(msg);
				}
			}
			
			// Do something about the request
			if (debug) console.log("sharkzapper:","<"+senderName+"<",request.command,request);
			switch(request.command) {
				case 'pinPopup':
					sharkzapper.popup.pin();
					break;	
					
				case 'unpinPopup':
					sharkzapper.popup.unpin();
					break;	
				
				case 'firstTabNavigate':
					if (!sharkzapper.message.ports.contentScript || !sharkzapper.message.ports.contentScript.tab || !sharkzapper.message.ports.contentScript.tab.id) return;
					if (sender.tab && sender.tab.id)
						sharkzapper.tabs.remove(sender.tab.id);
					sharkzapper.tabs.focus(sharkzapper.message.ports.contentScript.tab.id);
					break;
					
				case 'openGSTab':
					if (!sharkzapper.message.ports.contentScript || !sharkzapper.message.ports.contentScript.tab || !sharkzapper.message.ports.contentScript.tab.id) {
						var url = (request.url) ? "http://grooveshark.com/" + request.url : "http://grooveshark.com/";
						sharkzapper.tabs.open(url);
					} else {
						if (request.url)
							sharkzapper.tabs.navigate(sharkzapper.message.ports.contentScript.tab.id, request.url);
						sharkzapper.tabs.focus(sharkzapper.message.ports.contentScript.tab.id);
					}
					break;
					
				case 'fetchScript':
					sharkzapper.resources.fetch('js/sharkzapper_inject.js', function(script) {
						sendResponse({command: "injectScript", script: script});
					});
					break;
				case 'fetchSettings':
					sendResponse({command: "settingsUpdate", settings: sharkzapper.settings.fetchAll()});
					break;
					
				case 'openPopup':
					window.open(request.url, '', request.features);
					break;
				
				case 'statusUpdate':
					sharkzapper.status.update(request);
					sharkzapper.message.proxyToPopups(request);
					break;
					
				case 'settingsUpdate':
					if (request.settings)
						sharkzapper.settings.update(request.settings);
					sharkzapper.message.proxyToPopups(request);
					break;
					
				// Messages to proxy to contentscript
				case 'prevSong':
				case 'pauseSong':
				case 'playSong':
				case 'resumeSong':
				case 'nextSong':
				case 'voteSong':
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
					if (sharkzapper.message.ports.contentScript) {
						sharkzapper.message.ports.contentScript.send(request);
					}
					break;
				default:
					console.warn("Unhandled request: ", request.command, request);
			}
		},
		proxyToPopups: function(request) {
			for (i in sharkzapper.message.ports.popup) {
				sharkzapper.message.ports.popup[i].send(request);
			}
		}
	};
	
	sharkzapper.status = {
		cached: {},
		update: function status_update(status) {
			var songChange = false;
			var songClear = false;
			try {
				// Check if the song has changed (or has been cleared)
				if (status && status.hasOwnProperty('playbackStatus')) {
					if (status.playbackStatus && status.playbackStatus.hasOwnProperty('activeSong')) {
						if (!sharkzapper.status.cached.playbackStatus ||
							!sharkzapper.status.cached.playbackStatus.activeSong || 
							(status.playbackStatus.activeSong.hasOwnProperty('SongName') &&
								(status.playbackStatus.activeSong.SongName != sharkzapper.status.cached.playbackStatus.activeSong.SongName || 
								!sharkzapper.status.cached.playbackStatus.activeSong.SongName)
							) ||
							(status.playbackStatus.activeSong.hasOwnProperty('ArtistName') && 
								(status.playbackStatus.activeSong.ArtistName != sharkzapper.status.cached.playbackStatus.activeSong.ArtistName ||
								!sharkzapper.status.cached.playbackStatus.activeSong.ArtistName)
							) ||
							(status.playbackStatus.activeSong.hasOwnProperty('AlbumName') && 
								(status.playbackStatus.activeSong.AlbumName != sharkzapper.status.cached.playbackStatus.activeSong.AlbumName ||
								!sharkzapper.status.cached.playbackStatus.activeSong.AlbumName)
							)
						) 
						{
							 songChange = true;
						}
					} else if (!status.playbackStatus && sharkzapper.status.cached.playbackStatus) {
						songClear = true;
						sharkzapper.status.cached.playbackStatus = status.playbackStatus;
					}
				}
					
				sharkzapper.status.cached.playbackStatus = sharkzapper.status.undelta(status.playbackStatus, sharkzapper.status.cached.playbackStatus);
				if (songChange && sharkzapper.status.cached.playbackStatus.activeSong && sharkzapper.status.cached.playbackStatus.activeSong.SongName) {
					if (debug) console.warn('songChange', sharkzapper.status.cached.playbackStatus.activeSong.SongName, sharkzapper.status.cached.playbackStatus.activeSong.ArtistName, sharkzapper.status.cached.playbackStatus.activeSong.AlbumName);
					chrome.browserAction.setTitle({"title": "sharkZapper:\n" + sharkzapper.status.cached.playbackStatus.activeSong.SongName + "\n" + sharkzapper.status.cached.playbackStatus.activeSong.ArtistName + "\n" + sharkzapper.status.cached.playbackStatus.activeSong.AlbumName});
					if (sharkzapper.contextMenu.handles.curSong) 
						chrome.contextMenus.update(sharkzapper.contextMenu.handles.curSong, {title: "Now Playing: " + sharkzapper.status.cached.playbackStatus.activeSong.SongName + " - " + sharkzapper.status.cached.playbackStatus.activeSong.ArtistName});
					sharkzapper.notifications.songChange(sharkzapper.status.cached.playbackStatus.activeSong);
				}
				if (songClear) {
					if (debug) console.warn('songClear');
					chrome.browserAction.setTitle({"title":"sharkZapper"});
					if (sharkzapper.contextMenu.handles.curSong) 
						chrome.contextMenus.update(sharkzapper.contextMenu.handles.curSong, {title: 'Open Grooveshark'});
				}
			} catch (e) {
				console.warn('status_update_err:', e, e.stack);
			}
		},
		undelta: function (new_data, old_data) {
			return (function calc_undelta(new_data, old_data) {
				var undelta_data = {};
				if (old_data) {
					for (i in old_data) {
						undelta_data[i] = old_data[i];
					}
				}
				for (i in new_data) {
					if (typeof new_data[i] == 'object' && old_data && old_data.hasOwnProperty(i)) {
						undelta_data[i] = calc_undelta(new_data[i], old_data[i]); 
					} else {
						undelta_data[i] = new_data[i];
					}
				}
				return undelta_data
			})(new_data, old_data);
		}
	};
	
	/* Tabs Namespace */
	sharkzapper.tabs = {
		/** @private */
		openTabIds: [],
		injectScripts: ['js/jquery.min.js', 'js/sharkzapper_contentscript.js'],
		/**
		 * Find all currently open Grooveshark tabs
		 *
		 * @param {Function} success_callback
		 * @param {Function} failure_callback
		 * @param {Object} callback arguments
		 */
		findAll: function find_all_tabs(success_callback, fail_callback, arg) {
			chrome.windows.getAll({'populate':true}, function(win) {
				sharkzapper.tabs.openTabIds = [];
				for (wi in win) {
					for (ti in win[wi].tabs) {
						if(sharkzapper.tabs.checkUrl(win[wi].tabs[ti].url)) {
							sharkzapper.tabs.openTabIds.push(win[wi].tabs[ti].id);
						}
					}
				}
				if(sharkzapper.tabs.openTabIds.length > 0 && typeof success_callback == "function") {
					success_callback(arg);
				} else if(typeof fail_callback == "function") {
					fail_callback(arg);
				} 
			});
		},
		/** 
		 * Checks if URL is a Grooveshark URL
		 *
		 * @param {string} URL
		 * @return {Boolean}
		 */
		checkUrl: function check_tab_url(url) {
			return Boolean(url.indexOf('http://preview.grooveshark.com/')==0 || url.indexOf('http://grooveshark.com/')==0);
		},
		/**
		 * Injects script into first currently open Grooveshark tab
		 */
		injectFirst: function injectFirst() {
			sharkzapper.tabs.findAll(function inject_callback() {
				if (sharkzapper.tabs.openTabIds.length > 0) {
					sharkzapper.tabs.inject(sharkzapper.tabs.openTabIds[0]);
				}
			});
		},
		/**
		 * Injects scripts into specified tab id
		 * @param {string} Chrome Tab Id
		 */
		inject: function inject(tabId) {
			for (i in sharkzapper.tabs.injectScripts) {
				chrome.tabs.executeScript(tabId, {file: sharkzapper.tabs.injectScripts[i]});
			}
			if (debug) console.log('Injected scripts into existing tab #' + tabId);
		},
		/**
		 * Brings specified tab into focus (assuming Chrome is focused)
		 */
		focus: function focus(tabId) {
			chrome.tabs.update(tabId, {'selected':true});
		},
		/**
		 * Opens a tab 
		 * @param URL
		 */
		open: function open(url) {
			chrome.tabs.create({url: url});
		},
		/**
		 * Closes tab
		 * @param {string} Chrome Tab Id
		 */
		remove: function remove(tabId) {
			chrome.tabs.remove(tabId);
		},
		/**
		 * Navigates an existing tab to a new hash location
		 * @param {string} Chrome Tab Id
		 * @param {string} url hash fragment
		 */
		navigate: function(tabId,url) {
			chrome.tabs.get(tabId, function(tab) {
				var base = (tab.url.indexOf('#') !== -1) ? tab.url.substring(0,tab.url.indexOf('#')) : tab.url;
				if (tab.url == base + url) return;
				chrome.tabs.update(tabId, {'url': base + url});
			});
		}
	};
	
	/* Context Menu Namespace */
	sharkzapper.contextMenu = {
		/** @private */
		handles: {},
		/**
		 * Creates the context menu items
		 */
		create: function create_context_menu() {
			if (!sharkzapper.contextMenu.handles.curSong) 
				sharkzapper.contextMenu.handles.curSong = chrome.contextMenus.create({title:'Open Grooveshark', contexts:['all'], onclick: sharkzapper.actions.focusGS});
			if (!sharkzapper.contextMenu.handles.sep) 
				sharkzapper.contextMenu.handles.sep = chrome.contextMenus.create({type:'separator', contexts:['all']});
			if (!sharkzapper.contextMenu.handles.prev) 
				sharkzapper.contextMenu.handles.prev = chrome.contextMenus.create({title:'Previous Song', contexts:['all'], onclick: sharkzapper.actions.prev});
			if (!sharkzapper.contextMenu.handles.playPause) 
				sharkzapper.contextMenu.handles.playPause = chrome.contextMenus.create({title:'Play/Pause', contexts:['all'], onclick: sharkzapper.actions.playPause});
			if (!sharkzapper.contextMenu.handles.next) 
				sharkzapper.contextMenu.handles.next = chrome.contextMenus.create({title:'Next Song', contexts:['all'], onclick: sharkzapper.actions.next});	    
		},
		/** 
		 * Removes the context menu items
		 */
		destroy: function destroy_context_menu() {
			for (i in sharkzapper.contextMenu.handles) {
				chrome.contextMenus.remove(sharkzapper.contextMenu.handles[i]);
				delete sharkzapper.contextMenu.handles[i];
			}
		}
	};
	
	/* Popup Namespace */
	sharkzapper.popup = {
		pinnedPopupOpen: false,
		pin: function() {
			if (sharkzapper.popup.pinnedNotification || !window.webkitNotifications) return;
			sharkzapper.popup.pinnedNotification = window.webkitNotifications.createHTMLNotification(chrome.extension.getURL('html/sharkzapper_popup.html#notification'));
			sharkzapper.popup.pinnedNotification.ondisplay = function(){
				sharkzapper.popup.pinnedPopupOpen = true;
				sharkzapper.message.send({command: "statusUpdate", pinnedPopupOpen: sharkzapper.popup.pinnedPopupOpen, delta: true, cached: false}, 'popup');
			};
			sharkzapper.popup.pinnedNotification.onclose = function(){	
				sharkzapper.popup.pinnedPopupOpen = false;
				sharkzapper.popup.pinnedNotification = null;
				sharkzapper.message.send({command: "statusUpdate", pinnedPopupOpen: sharkzapper.popup.pinnedPopupOpen, delta: true, cached: false}, 'popup');
			};
			sharkzapper.popup.pinnedNotification.show();
		},
		unpin: function() {
			if (!sharkzapper.popup.pinnedNotification) return;
			sharkzapper.popup.pinnedNotification.cancel();
		}
	};
	
	sharkzapper.notifications = {
		songNotifications: [],
		songChange: function (song) {
			if (window.webkitNotifications && sharkzapper.settings.fetch("showNotificationOnSongChange")) {
				console.log(song);
				for (i in sharkzapper.notifications.songNotifications) {
					sharkzapper.notifications.songNotifications.shift().cancel();
				}
				notification = window.webkitNotifications.createHTMLNotification(chrome.extension.getURL('html/sharkzapper_songnotification.html#' + JSON.stringify(song)));
				//notification = window.webkitNotifications.createNotification((song.CoverArtFilename && song.artPath) ? song.artPath + 'm' + song.CoverArtFilename : 'http://static.a.gs-cdn.net/webincludes/images/default/album_100.png', song.SongName, song.ArtistName + "\n" + song.AlbumName); 
				notification.ondisplay = function(notification) { return function() { setTimeout(function(){ 
					if (sharkzapper.notifications.songNotifications.indexOf(notification) === -1) return notification.cancel();
					sharkzapper.notifications.songNotifications.splice(sharkzapper.notifications.songNotifications.indexOf(notification),1);
					notification.cancel();
				}, 5000); } }(notification);
				notification.show();
				sharkzapper.notifications.songNotifications.push(notification);
			}
		}
	};
	
	/* Resources Namespace */
	sharkzapper.resources = {
		fetch: function fetch(url, callback) {
			var xhr = new XMLHttpRequest();
			xhr.open("GET",chrome.extension.getURL(url));
			xhr.onreadystatechange=function() {
				if (this.readyState == 4) {
					callback(xhr.responseText, url);
				}
			};
			xhr.send();
		}
	};
	
	/* Actions Namespace */
	sharkzapper.actions = {
		playPause: function playPause() {
			sharkzapper.message.send({command:"togglePlayPause"},'contentScript');
		},
		prev: function prev() {
			sharkzapper.message.send({command:"prevSong"},'contentScript');
		},
		next: function next() {
			sharkzapper.message.send({command:"nextSong"},'contentScript');
		},
		focusGS: function focusGS() {
			if (!sharkzapper.message.ports.contentScript || !sharkzapper.message.ports.contentScript.tab || !sharkzapper.message.ports.contentScript.tab.id) {
				sharkzapper.tabs.open("http://grooveshark.com/");
			} else {
				sharkzapper.tabs.focus(sharkzapper.message.ports.contentScript.tab.id);
			}
		}
	};
	
	/**
	 * Performs any initalisation routines 
	 *
	 * @return {SharkZapperBackground} sharkzapper
	 */
	sharkzapper.init = function init() {
		sharkzapper.settings.upgrade();
		sharkzapper.listeners.bind();
		if (sharkzapper.settings.fetch("showContextMenu")) {
			sharkzapper.contextMenu.create();
		}
		sharkzapper.tabs.injectFirst();
		chrome.browserAction.setTitle({"title":"sharkZapper"});
		return sharkzapper;
	}
	
	return sharkzapper.init();
})(true) //debug
 
//TODO: Rewrite in similar style to popup and content script for 1.4+
// Global variables
/*var defaultAlbumArtUrl = 'http://static.a.gs-cdn.net/webincludes/images/default/album_100.png';	
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
var settingsVersion = 8;
var contextMenu = {};
var defaultSettings = {"newTabOnPopupClick": true, "showMuteButton": true, "showQueuePosition": true, "showQueueButtons": true, "showPlaybackButtons": true, "showNotificationOnSongChange": false, "showSearchBox": true, "showVolumeControlOnHover": true, "showAlbumArt": true, "enableSharkzapperMobile": false}; 

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
 				if(win[wi].tabs[ti].url.indexOf('http://preview.grooveshark.com/')==0 || win[wi].tabs[ti].url.indexOf('http://grooveshark.com/')==0) {
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
		chrome.tabs.executeScript(gsTabs[0], {'file':'js/jquery.min.js'});		
		chrome.tabs.executeScript(gsTabs[0], {'file':'js/sharkzapper_contentscript.js'});
		if (debug) console.log('Injected scripts into existing tab #' + gsTabs[0]);
		
		// Add our context menu
		create_contextmenu();
	}
}

// Open a new grooveshark tab or show the currently open one if there is one
function open_gs_tab(url) { //TODO: fix so preview.grooveshark.com tabs work
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
			    //TODO: Use chrome.browserAction.onClicked.addListener and chrome.browserAction.setPopup to open new tab instead, requires tracking open tabs
				if (debug) console.log('Got popup init, re-checking tabs');
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
		        socket_send_update(request);
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
                
            case 'fetchInject':
                var xhr = new XMLHttpRequest();
                xhr.open("GET",chrome.extension.getURL('js/sharkzapper_inject.js'));
                xhr.onreadystatechange=function() {
                    if (this.readyState == 4) {
                        if (xhr.responseText) {
                            sendRequest({command: 'injectScript', script: xhr.responseText}, 'tab');
                        } else {
                            console.error("Could not fetch sharkzapper_inject.js", this);
                        }
                    }
                }
                xhr.send();
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
                            } else {
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
                break;
            
            // This is sent to get all the settings
            case 'fetchSettings':
                if (!localStorage.settings) return;
                request.command = "settingsUpdate";
                request.settings = JSON.parse(localStorage.settings);
                sendRequest(request,'extension');
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
                
            // This is sent to get a single setting, and sends the response directly back (requires callback on sender)
            case 'getSetting':
                if (!request.settingName) return;
                sendResponse(getSetting(request.settingName));
                break;
                
            // Note that this does not open THE popup, it opens a popup window...
            case 'openPopup':
                window.open(request.url, '', request.features);
                break
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
		    chrome.tabs.sendRequest(gsTabs[0], request); 
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
    if (!socket || !socket.connected) { return; } //ignore when not connected
    if (!status) {
        var params = {currentSong: {}};
        if (lastStatus.hasOwnProperty('isMuted')) params.isMuted = lastStatus.isMuted;
        if (lastStatus.hasOwnProperty('isPaused')) params.isPaused = lastStatus.isPaused;
        if (lastStatus.hasOwnProperty('isPlaying')) params.isPlaying = lastStatus.isPlaying;
        if (lastStatus.hasOwnProperty('shuffle')) params.shuffle = lastStatus.shuffle;
        var paramsSet = false;
        for (i in lastSong) {
            params.currentSong[i] = lastSong[i];
            paramsSet = true;
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
}
function socket_handle_connect_failed(e) {
    console.error('Socket connect failed',e);
}

// Inject all currently open tabs with our content script
get_gs_tab(inject_scripts); 

// Open socket connection if sharkzapperMobile is enabled
if (getSetting('enableSharkzapperMobile') == true) {
    load_socket();
}*/
