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
var sharkzapper = new (function SharkZappperContentScript(debug) {
	var sharkzapper = this;
	sharkzapper.version = '1.4.1';
	
	sharkzapper.listeners = {
		bind: function bind_listeners() {
		
		},
		unbind: function unbind_listeners() {
		
		}
	};
	
	sharkzapper.inject = {
		scripts: [],
		injectScript: function inject_script(data) {
			var inject = document.createElement('script');
			inject.id = 'sharkzapperInject'; 
			inject.className = 'version_'+sharkzapper.version;
			inject.innerHTML = data;
			if (debug)
				console.log("injecting sharkzapper version "+sharkzapper.version, inject);
			try {
				document.body.appendChild(inject);
				sharkzapper.inject.scripts.push(inject);
			} catch (e) {
				console.error('sharkzapper:', e);
			}
		},
		cleanUp: function() {
			for (i in sharkzapper.inject.scripts) {
				document.body.removeChild(sharkzapper.inject.scripts[i]);
			}
		}
	};
	
	/**
	 * @constructor
	 */
	function SharkZapperMessages() {
		this.port = chrome.extension.connect({name: "contentScript"});
		this.port.onMessage.addListener(this.callback(this.handlePortMessage));
		window.addEventListener("message", this.callback(this.handleWindowMessage));
	};
	SharkZapperMessages.prototype.handlePortMessage = function recieve_message(data) {
		if (debug) console.log('sharkzapper:', '<(P)C<', data);
		if (!data.command)
			return;
		switch(data.command) {
			case 'cleanUp':
				if (debug) console.warn("cleaning up because sharkzapper is open in another tab");
				sharkzapper.cleanUp();
				
				if (data.showTabWarning) {
					if (debug) console.log('showing tab warning');
					var script = document.createElement('script');
					script.id = 'sharkzapperTabWarning';
					script.innerHTML = '$.publish("gs.notification", {type: "error", displayDuration: 120000, message: "Grooveshark is already open in <a href=\\"#\\" onclick=\\"window.postMessage(JSON.stringify({\'command\':\'firstTabNavigate\'}), location.origin);return false;\\">another tab</a>, please close this tab if you wish to use SharkZapper"});';
					document.body.appendChild(script);
					window.addEventListener("message", function listen_for_firsttabnavigate(e) {
						if (e.origin != location.origin) return;
						var request = JSON.parse(e.data)
						if (request.command != 'firstTabNavigate') return;
						if (debug) console.log("got firstTabNavigate message", request);
						chrome.extension.sendRequest(request);
						window.removeEventListener("message",listen_for_firsttabnavigate,false);
					});
				}
				break;
			case 'contentScriptUpdate':
				this.version = data.version;
				break;
			case 'injectScript':
				sharkzapper.inject.injectScript(data.script, this.version);
				break;
                
            case 'setDebugLevel':
                debug = data.level;
                this.sendMessage(data);
                break;
                
            // Proxy requests onto injection script via HTML5 Message events
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
            case 'mobileBinded':
            case 'mobileUnbinded':
				this.sendMessage(data);
				break;
			default: 
				console.warn("Unhandled message from port:", data.command, data);
		}
	}
	SharkZapperMessages.prototype.handleWindowMessage = function(e) {
		if (e.origin != location.origin)
			return;
		var request = JSON.parse(e.data);
        if (debug) console.log('sharkzapper:', '<(M)C<', request);
		switch (request.command) {
			case 'cleanUp':
				sharkzapper.cleanUp();
				break;
			case 'contentScriptInit':
		    case 'statusUpdate':
            case 'settingsUpdate':
		    case 'firstTabNavigate':
            case 'notification':
            case 'interactionTimePrompt':
            case 'fetchView':
            case 'fetchSettings':
            case 'openPopup':
				this.sendRequest(request);
				break;
			default:
				console.warn("sharkzapper:", "Unhandled message from injection:", request.command, request);
		}
	};
	SharkZapperMessages.prototype.callback = function(fn) {
		var a=this;
		var f=(function() {
			fn.apply(a, arguments);
		});
		this.callbacks = this.callbacks || {};
		this.callbacks[fn]=f;
		return f;
	};
	SharkZapperMessages.prototype.sendMessage = function(data) {
		if(debug) console.log("sharkzapper:",">(M)C>",data.command, data);
		window.postMessage(JSON.stringify(data), location.origin);
	};
	SharkZapperMessages.prototype.sendRequest = function(data) {
        if(debug) console.log("sharkzapper:",">"+this.port.name+">",data.command, data);
        try {
            this.port.postMessage(data);
        } catch (e) {
            console.warn("sharkzapper:",'attempted to send to disconnected port, this data will be lost:', data.command, data);
        }
	};
	SharkZapperMessages.prototype.cleanUp = function() {
		this.port.onMessage.removeListener(this.callbacks[this.handlePortMessage]);
		this.port.disconnect();
		window.removeEventListener("message", this.callbacks[this.handleWindowMessage]);
	};
	
	sharkzapper.cleanUp = function() {
		if (debug) console.log('Got clean up message, cleaning up...');
		sharkzapper.messages.cleanUp();
		sharkzapper.inject.cleanUp();
		if (debug) console.log('Cleanupdone, sending message');
		window.postMessage(JSON.stringify({command:'cleanupDone'}), location.origin);
	};
	/**
	 * Called after previous script has finished cleaning up
	 */
	sharkzapper.init = function init() {
		if (debug) { console.log('Initialising sharkzapper version'+sharkzapper.version); }
		sharkzapper.messages = new SharkZapperMessages();
		return sharkzapper;
	};
	
	// Check URL
	if (window.location.pathname.substring(1).indexOf('/') !== -1 || window.location.pathname.indexOf('.') !== -1) {
		if (debug) console.warn("Not injecting sharkZapper into this page due to url:", window.location.pathname);
		return null;
	}
	
	// Check for old injections and init
	(function check_and_init() {
		var inject = document.getElementById('sharkzapperInject');
        // Clean up old injection regardless of newer or debug mode (required as otherwise will be using a disconnected port)
		if (inject) {
			if (debug) console.log('sharkzapper already injected ('+inject.className+'), trying to remove and replace with us! (using postMessage method)');
			if (debug) console.warn("sharkzapper: posting cleanup");
			window.postMessage(JSON.stringify({"command":"cleanUp"}), location.origin);
			window.addEventListener("message", function listen_for_cleanup_done(e) {
				if (e.origin != location.origin) return;
				var request = JSON.parse(e.data)
				if (request.command != 'cleanupDone') return;
				if (debug) console.log("got cleanupDone message", request);
				sharkzapper.init();
				window.removeEventListener("message",listen_for_cleanup_done,false);
			});
		} else if (!inject) {
			if (debug) console.log('no sharkzapper already found, just initalising');
			sharkzapper.init();
		}
	})();
})(false); //debug
