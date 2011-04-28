/*
 * sharkzapper_inject.js
 * This is the inject script for sharkZapper which handles all communication between Grooveshark's JS API and the content script
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
var sharkzapper = new (function SharkZapper(debug){
    var sharkzapper = this;
    sharkzapper.cache = {};
    sharkzapper.listeners = {
        bind: function bind_listners() {
            // DOM Events
            window.addEventListener("message", sharkzapper.listeners.message, false);
            
            // GS Events
            $.subscribe("gs.player.playstatus", sharkzapper.listeners.playstatus);
        },
        unbind: function unbind_listeners() {
            // DOM Events
            window.removeEventListener("message", sharkzapper.listeners.message);
            
            // GS Events
            $.unsubscribe("gs.player.playstatus", sharkzapper.listeners.playstatus);
        },
        error: function handle_error(e) {
            console.error('sharkzapper error:',e);
        },
        message: function handle_message(e) {
            // Ignore external messages
            if (e.origin != location.origin) return;
            
            // Parse all messages as JSON
            var request = JSON.parse(e.data);
            
            // Prevent feedback
            if (request.source && request.source == 'page') return;
            
            // Print debug request
            if (debug) console.log("sharkzapper:", "<P<", request.command, request);
            
            // Switch on command
            switch (request.command) {
            
            }
        }, 
        playstatus: function handle_playstatus(status) {
            sharkzapper.message.send({"command": "statusUpdate", "playbackStatus": sharkzapper.helpers.delta(status, 'playbackStatus')});
        }
    };
    sharkzapper.message = {
        send: function message_send(data) {
            if (debug) console.log("sharkzapper:", ">P>", data);
            data.source = "page";
            if (debug) data.timestamp = (new Date()).valueOf();
            window.postMessage(JSON.stringify(data), location.origin);
        }
    };
    sharkzapper.helpers = {
        delta: function delta(new_data, key) {
            if (!sharkzapper.cache[key]) {
                sharkzapper.cache[key] = new_data;
                return new_data;
            } else {
                var old_data = sharkzapper.cache[key];
                var delta_data = (function calc_delta(new_data, old_data) {
                    var delta_data = {};
                    for (i in new_data) {
                        if (new_data[i] != old_data[i]) {
                            if (typeof new_data[i] == 'object') {
                                delta_data[i] = calc_delta(new_data[i], old_data[i]); 
                            } else {
                                delta_data[i] = new_data[i];
                            }
                        }
                    }
                    return delta_data
                })(new_data, old_data);
                sharkzapper.cache[key] = new_data;
                return delta_data;
            }
        }
    };
    sharkzapper.destroy = function destroy() {
        try {
            sharkzapper.listeners.unbind();
        } catch(e) {}
        sharkzapper = null;
        delete window.sharkzapper;
    };
    sharkzapper.external = new (function SharkZapper_ExternalInterface() {
        if (debug) this.internal = sharkzapper;
        
        
    })();
    sharkzapper.init = function init() {
        try {
            sharkzapper.listeners.bind();
        } catch (e) {
            sharkzapper.listeners.error(e);
        }
        
        return sharkzapper.external;
    };
    return this.init();
})(true);
