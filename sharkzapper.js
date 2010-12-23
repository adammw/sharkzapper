/*
 * sharkZapper is Copyright (C) 2010 Adam Malcontenti-Wilson <adman.com@gmail.com>
 * You are hereby granted a licence to use the software as-is, and view the source code for educational purposes.
 * You may not create deriviate versions of the software without written permission of the author.
 * 
 * Grooveshark imagery and related media is Copyright (C) Escape Media Group. 
 * "Grooveshark" and Grooveshark Logos are trademarks of Escape Media Group.
 */
var recieveMessage, sendRequest, inject, tabnavListener;
var debug = false;
var thisVersion = '1.2.7';
function inject_sharkzapper() {
    if(debug) console.log("injecting sharkzapper version "+thisVersion);
    sendRequest({"command": "getTabCount"});

    function receiveMessage(e) {
        if (e.origin != "http://listen.grooveshark.com") return;
	    var request = JSON.parse(e.data);
        if (debug) console.log('sharkzapper:', '<(M)C<', request);
	    switch (request.command) {
		    //case 'contentScriptInit':
		    case 'statusUpdate':
		    case 'firstTabNavigate':
            case 'notification':
            case 'interactionTimePrompt':
			    sendRequest(request);
                break;
            case 'removeListener':
                window.removeEventListener("message",receiveMessage,false);
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
        window.postMessage(JSON.stringify(message), "http://listen.grooveshark.com");
    }

    function recieveRequest(request, sender, sendResponse) {
        if (debug) console.log('sharkzapper:', '<(R)C<', request, sender);
	    switch (request.command) {
		    case 'prevSong':
		    case 'pauseSong':
		    case 'playSong':
		    case 'resumeSong':
		    case 'nextSong':
		    case 'updateStatus':
		    case 'toggleMute':
		    case 'performSearch':
		    case 'addToLibrary':
		    case 'removeFromLibrary':
		    case 'addToSongFavorites':
		    case 'removeFromSongFavorites':
            case 'toggleSmile':
            case 'toggleFrown':
            case 'interactionTimeResume':
			    sendMessage(request);
			    break;
		    case 'tabCount':
			    if (debug) console.log('There are ' + request.tabCount + ' open grooveshark tabs!');
			    if (request.tabCount != 1) {
				    if (!document.getElementById('sharkzapper_warning_bar')) {
					    warn = document.createElement('div');
					    warn.id = 'sharkzapper_warning_bar';
					    warn.innerHTML = '<div style="position: absolute; top: 0px; z-index: 100000; color: black; width: 100%; text-align: center; font-size: 120%; padding: 12px; background-color: rgba(255, 255, 224, 0.8); ">Grooveshark is already open in <a href="http://listen.grooveshark.com/" onclick="window.postMessage(JSON.stringify({\'command\':\'firstTabNavigate\'}), \'http://listen.grooveshark.com\'); ">another tab</a>, please close this tab if you wish to use SharkZapper. <span style="float:right; margin-right: 24px;"><a href="#/" onclick="document.body.removeChild(document.getElementById(\'sharkzapper_warning_bar\'));">close</a></span></div>';
					    document.body.appendChild(warn);
                        window.addEventListener("message", tabnavListener, false);  // listen for "firstTabNavigate" message 
                                                                                    // can't rely on normal listener as it will be cleaned up by clean_up()
				    }
				    if (document.getElementById('sharkzapperInject')) { clean_up(); }
			    }
			    break;
	    }
    }

    function sendRequest(request) {
        if (!request.source) request.source = "contentscript";
        if (debug) console.log('sharkzapper:', '>(R)C>', request);
        chrome.extension.sendRequest(request);
    }


    window.addEventListener("message", receiveMessage, false);  

    chrome.extension.onRequest.addListener(recieveRequest);

    inject = document.createElement('script');
    inject.id = 'sharkzapperInject'; 
    inject.className = 'version_'+thisVersion;
    inject.innerHTML = '        var sharkzapper_debug = false;\
                                function sharkzapper_update_status() {\
                                gs_status = {\
					                "command": "statusUpdate",\
					                "playbackStatus": GS.player.getPlaybackStatus(),\
					                "currentSong": GS.player.currentSong,\
					                "isPlaying": GS.player.isPlaying,\
					                "isPaused": GS.player.isPaused,\
					                "isMuted": GS.player.getIsMuted()\
				                };\
				                if (GS.player.currentSong) {\
					                gs_status.urls = {"song": GS.player.currentSong.toUrl()};\
				                    gs_status.urls.artist = _.cleanUrl(gs_status.currentSong.ArtistName, gs_status.currentSong.ArtistID, "artist");\
			                        gs_status.urls.album = _.cleanUrl(gs_status.currentSong.AlbumName, gs_status.currentSong.AlbumID, "album");\
				                }\
                                if (GS.player.queue) {\
					                gs_status.prevSong = GS.player.queue.previousSong;\
					                gs_status.nextSong = GS.player.queue.nextSong;\
                                }\
                                if ($("#queue_list li.queue-item-active div.radio_options").hasClass("active")) {\
                                    gs_status.isRadio = true;\
                                    gs_status.isSmile = $("#queue_list li.queue-item-active div.radio_options a.smile").hasClass("active");\
                                    gs_status.isFrown = $("#queue_list li.queue-item-active div.radio_options a.frown").hasClass("active");\
                                } else {\
                                    gs_status.isRadio = false;\
                                }\
				                sharkzapper_post_message(gs_status);\
		                    }\
			                function sharkzapper_post_message(message) {\
                                if (sharkzapper_debug) console.log("sharkzapper:", ">P>", message);\
				                message.source = "page";\
				                window.postMessage(JSON.stringify(message), "http://listen.grooveshark.com");\
			                }\
                            function sharkzapper_handle_notification(n) {\
                                n.command="notification";\
                                sharkzapper_post_message(n);\
                            }\
					        function sharkzapper_handle_message(e) {\
						        if (e.origin == "http://listen.grooveshark.com") {\
							        var request = JSON.parse(e.data);\
							        if (request.source == "page") { return; }\
							        if (sharkzapper_debug) console.log("sharkzapper:", "<P<", request);\
							        switch (request.command) {\
								        case "pauseSong":\
									        GS.player.pauseSong();\
									        break;\
								        case "resumeSong":\
									        GS.player.resumeSong();\
									        break;\
								        case "prevSong":\
									        GS.player.previousSong();\
									        break;\
									    case "playSong":\
									        GS.player.playSong();\
								            break;\
								        case "nextSong":\
									        GS.player.nextSong();\
									        break;\
								        case "updateStatus":\
									        sharkzapper_update_status();\
									        break;\
								        case "toggleMute":\
									        $("#player_volume").click();\
									        sharkzapper_update_status();\
									        break;\
								        case "addToLibrary":\
									        if (request.songId) GS.user.addToLibrary(request.songId);\
									        break;\
								        case "removeFromLibrary":\
									        if (request.songId) GS.user.removeFromLibrary(request.songId);\
									        break;\
								        case "addToSongFavorites":\
									        if (request.songId) GS.user.addToSongFavorites(request.songId);\
									        break;\
								        case "removeFromSongFavorites":\
									        if (request.songId) GS.user.removeFromSongFavorites(request.songId);\
									        break;\
                                        case "toggleSmile":\
                                            $("#queue_list li.queue-item-active div.radio_options a.smile").click();\
                                            break;\
                                        case "toggleFrown":\
                                            $("#queue_list li.queue-item-active div.radio_options a.frown").click();\
                                            break;\
								        case "performSearch":\
									        GS.router.performSearch("all",request.query);\
									        break;\
								        case "interactionTimeResume":\
    								        GS.player.resumeSong();\
								            GS.lightbox.close();\
								            break;\
							        }\
						        }\
					        }\
                            window.addEventListener("message", sharkzapper_handle_message, false);\
					        sharkzapper_post_message({"command":"contentScriptInit"});\
                            if(!GS.player.playerStatus_) {\
                                GS.player.playerStatus_=GS.player.playerStatus;\
                                GS.player.playerStatus=function(b){GS.player.playerStatus_(b);sharkzapper_update_status();};\
                            }\
                            if(!GS.lightbox.open_) {\
                                GS.lightbox.open_=GS.lightbox.open;\
                                GS.lightbox.open=function(a,b){GS.lightbox.open_(a,b);if(a=="interactionTime"){sharkzapper_post_message({"command":"interactionTimePrompt"})}};\
                            }\
                            $.subscribe("gs.notification",sharkzapper_handle_notification);\
					        $.subscribe("gs.player.queue.change",sharkzapper_update_status);\
                            $.subscribe("gs.auth.song.update",sharkzapper_update_status);\
                            $.subscribe("gs.auth.favorites.songs.add",sharkzapper_update_status);\
                            $.subscribe("gs.auth.favorites.songs.remove",sharkzapper_update_status);\
                            $.subscribe("gs.auth.library.add",sharkzapper_update_status);\
                            $.subscribe("gs.auth.library.remove",sharkzapper_update_status);\
                            \
                            $(".queueSong .smile, .queueSong .frown").click(sharkzapper_update_status);';
    document.body.appendChild(inject);
}
function clean_up(injectNew) {
    if (debug) console.log('running cleanup with injectNew:', injectNew);		
    // add listener to run injection when done cleaning up
    window.addEventListener("message", cleanupDoneListener, false); 
    	
	// clean up old injection
    document.body.removeChild(document.getElementById('sharkzapperInject'));
    cleanup = document.createElement('script');
    cleanup.id = 'sharkzapperCleanUp'; 
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
                        document.body.removeChild(document.getElementById("sharkzapperCleanUp"));\
                        if (sharkzapper_debug) console.log("cleanup stage1 done!");';
    cleanup.innerHTML=js;
    document.body.appendChild(cleanup);
    
}
function tabnavListener(e){
    if (e.origin != "http://listen.grooveshark.com") return;
    var request = JSON.parse(e.data)
    if (request.command != 'firstTabNavigate') return;
    chrome.extension.sendRequest(request);
    window.removeEventListener("message",tabnavListener,false);
}
function cleanupDoneListener(e){
    if (e.origin != "http://listen.grooveshark.com") return;
    var request = JSON.parse(e.data)
    if (request.command != 'cleanupDone') return;
    window.removeEventListener("message",cleanupDoneListener,false);
    if (debug) console.log("got cleanupDone message, inject new:",request.injectNew);
    if (request.injectNew) { inject_sharkzapper(); }
}
var inject = document.getElementById('sharkzapperInject');
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
    inject_sharkzapper();
}
