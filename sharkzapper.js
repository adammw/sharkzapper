var recieveMessage, sendRequest, inject, tabnavListener;
function inject_sharkzapper() {

    sendRequest({"command": "getTabCount"});

    function receiveMessage(e) {
        if (e.origin != "http://listen.grooveshark.com") return;
	    var request = JSON.parse(e.data);
        console.log('sharkzapper:', '<(M)C<', request);
	    switch (request.command) {
		    case 'contentScriptInit':
		    case 'statusUpdate':
		    case 'firstTabNavigate':
			    sendRequest(request);
                break;
            case 'removeListener':
                window.removeEventListener("message",receiveMessage,false);
                chrome.extension.onRequest.removeListener(recieveRequest);
                receiveMessage = function(e){ console.error('got messages from dead function',e); };
                receiveRequest = function(e){ console.error('got requests from dead function',e); };
                if (request.injectNew) {
                    console.log("cleanup stage2 done! attempting to inject new sharkzapper");
                    inject_sharkzapper();
                    console.log("new sharkzapper injected, hopefully");
                } else {
                    console.log("cleanup stage2 done! leaving.");
                }
                break;
	    }
    }

    function sendMessage(message) {
        console.log('sharkzapper:', '>(M)C>', message);
        window.postMessage(JSON.stringify(message), "http://listen.grooveshark.com");
    }

    function recieveRequest(request, sender, sendResponse) {
        console.log('sharkzapper:', '<(R)C<', request, sender);
	    switch (request.command) {
		    case 'prevSong':
		    case 'pauseSong':
		    case 'resumeSong':
		    case 'nextSong':
		    case 'updateStatus':
		    case 'toggleMute':
		    case 'performSearch':
		    case 'addToLibrary':
		    case 'removeFromLibrary':
		    case 'addToSongFavorites':
		    case 'removeFromSongFavorites':
			    sendMessage(request);
			    break;
		    case 'tabCount':
			    console.log('There are ' + request.tabCount + ' open grooveshark tabs!');
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
        console.log('sharkzapper:', '>(R)C>', request);
        chrome.extension.sendRequest(request);
    }


    window.addEventListener("message", receiveMessage, false);  

    chrome.extension.onRequest.addListener(recieveRequest);

    inject = document.createElement('script');
    inject.id = 'sharkzapperInject'; //if($('#player_play_pause').hasClass('pause'))
    inject.innerHTML = '    function sharkzapper_update_status() {\
                                gs_status = {\
					                "command": "statusUpdate",\
					                "playbackStatus": GS.player.getPlaybackStatus(),\
					                "currentSong": GS.player.currentSong,\
					                "isPlaying": GS.player.isPlaying,\
					                "isPaused": GS.player.isPaused,\
					                "isMuted": GS.player.getIsMuted()\
				                };\
				                if (gs_status.currentSong) {\
					                gs_status.currentSong.fromLibrary = GS.user.library.songs.hasOwnProperty(gs_status.currentSong.SongID);\
					                gs_status.currentSong.isFavorite = GS.user.favorites.songs.hasOwnProperty(gs_status.currentSong.SongID);\
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
                                console.log("sharkzapper:", ">P>", message);\
				                message.source = "page";\
				                window.postMessage(JSON.stringify(message), "http://listen.grooveshark.com");\
			                }\
					        function sharkzapper_handle_message(e) {\
						        if (e.origin == "http://listen.grooveshark.com") {\
							        var request = JSON.parse(e.data);\
							        if (request.source == "page") { return; }\
							        console.log("sharkzapper:", "<P<", request);\
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
							        }\
						        }\
					        }\
                            window.addEventListener("message", sharkzapper_handle_message, false);\
					        sharkzapper_post_message({"command":"contentScriptInit"});\
					        $.subscribe("gs.player.nowplaying",sharkzapper_update_status);\
					        $.subscribe("gs.player.queue.change",sharkzapper_update_status);\
					        $.subscribe("gs.player.playing.continue",sharkzapper_update_status);\
					        $.subscribe("gs.player.paused",sharkzapper_update_status);';
    document.body.appendChild(inject);
}
function clean_up(injectNew) {
    console.log('running cleanup with injectNew:', injectNew);			
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
    js += '              $.unsubscribe("gs.player.nowplaying",sharkzapper_update_status);\
					    $.unsubscribe("gs.player.queue.change",sharkzapper_update_status);\
					    $.unsubscribe("gs.player.playing.continue",sharkzapper_update_status);\
					    $.unsubscribe("gs.player.paused",sharkzapper_update_status);\
                        document.body.removeChild(document.getElementById("sharkzapperCleanUp"));\
                        console.log("cleanup stage1 done!");';
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
if (document.getElementById('sharkzapperInject')) {
    console.log('sharkzapper already injected, trying to remove and replace with us! (crosses fingers)');			
	clean_up(true);
} else {
    inject_sharkzapper();
}
