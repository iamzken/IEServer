
/*
 * nathost_port.js
 *
 * A wrapper for a native host port that provides additional functionality, like:
 *
 * -- sendMessage similar to sendMessage for tabs that provides callback semantics.
 * -- Functionality for tracking the time the last message was sent.
 * -- The ability to determine the number of listeners.
 *
 * Usage:
 *
 * var nathostPort = new NativeHostPort(realPort);
 *
 *
 * Public functionality:
 *
 * onMessage
 * onDisconnect
 * sendMessage
 * postMessage
 * hasListeners
 * getLastSentMessageTime
 * setIncludeWithAll
 * isConnected
 * disconnect
 *
*/

var NativeHostPort = function(port) {
    this._CALLBACK_TIMEOUT = 30000;
    this._port = port;
    this._id = Math.floor(Math.random() * 10000000);
    this._nextCallbackId = 1;
    this._pendingCallbacks = {};
    this._fnOnNativeMessage = null;
    this._listeners = [];
    this._lastMessageSent = new Date();

    this._postMessageToListeners = function(msg) {
        for (var i=0; i<this._listeners.length; i++) {
            try {
                this._listeners[i](msg);
            } catch(ex) {
                console.error(ex.message, ex.stack);
            }
        }
    }.bind(this);

    this._handleMessage = function(msg) {
        if (window.Background) {
            // See if the background window wants to handle this message
            return window.Background.handleNativeMessage(this, msg);
        } else {
            return false;
        }
    }.bind(this);

    this._port.onMessage.addListener(function(msg) {
        if (msg._responseId) {
            // This was a "sendMessage" potentially with a callback, so call it.
            var fnResponse = this._pendingCallbacks[msg._responseId];
            if (!fnResponse) {
                return;
            }
            delete this._pendingCallbacks[msg._responseId];
            delete msg[msg._responseId];
            fnResponse(msg);
        } else {
            // See if the background page wants to handle it
            if (!this._handleMessage(msg)) {
                // Forward to all listeners
                this._postMessageToListeners(msg);
            }
        }
    }.bind(this));

    this._port.onDisconnect.addListener(function() {
        this._port = null;
        // Remove all listeners
        this._listeners = [];
        this._pendingCallbacks = [];

    }.bind(this));

    this.sendMessage = function(msg, fnResponse) {
        if (fnResponse) {
            var callId = msg._callId = this._id + ':' + this._nextCallbackId++;
            this._pendingCallbacks[callId] = fnResponse;

            // Delete the callback entry if the callback never happens
            window.setTimeout(function() {
                if (this._pendingCallbacks[callId]) {
                    delete this._pendingCallbacks[callId];
                }
            }.bind(this), this._CALLBACK_TIMEOUT);
        }
        this.postMessage(msg);
    }.bind(this);


    this.onMessage = {
        addListener: function(fnListener) {
            this._listeners.push(fnListener);
        }.bind(this),

        removeListener: function(fnListener) {
            for (var i=0; i<this._listeners.length; i++) {
                if (this._listeners[i] == fnListener) {
                    this._listeners.splice(i, 1);
                    break;
                }
            }
        }.bind(this)
    }

    this.hasListeners = function() {
        return this._listeners.length > 0;
    }

    this.onDisconnect = {
        addListener: function(listener) {
            this._port.onDisconnect.addListener(listener);
        }.bind(this),
        removeListener: function(listener) {
            this._port.onDisconnect.removeListener(listener);
        }.bind(this)
    }

    this.postMessage = function(msg) {
        if (this._includeWithAll) {
            msg = $.extend(msg, this._includeWithAll);
        }

        this._lastMessageSent = (new Date()).getTime();
        this._port.postMessage(msg);
    }

    this.getLastSentMessageTime = function() {
        return this._lastMessageSent;
    }

    this.isConnected = function() {
        return !!this._port;
    }

    this.disconnect = function() {
        this._port.disconnect();
    }

}
