/*
**    cookies.js
*
*     Support for storing / sharing session cookies between instances of the helper process
*/

var Cookies = {
    sessionCookies: {},

    broadcastCookieUpdate: function(srcPort, theCookie) {
        var allPorts = NativeHostManager.getAllOpenHosts();
        var newCookie = {
            url: theCookie['url'],
            cookieData: theCookie['cookieData']
        }

        var msg = { type: 'UPDATE_COOKIES', cookies: [ newCookie ] };
        for (var hostName in allPorts) {
            var destPort = allPorts[hostName];
            if (destPort != srcPort) {
                destPort.sendMessage(msg);
            }
        }
    },

    sendSessionCookies: function(port) {
        var allCookies = [];

        var theCookie = {};
        for (var domain in this.sessionCookies) {
            for (var path in this.sessionCookies[domain]) {
                var pathCookies = this.sessionCookies[domain][path];
                for (var cookieName in pathCookies) {
                    allCookies.push(pathCookies[cookieName]);
                }
            }
        }

        if (allCookies.length) {
            var msg = { type: 'UPDATE_COOKIES', cookies: allCookies };
            port.sendMessage(msg);
        }
    },

    updateSessionCookie: function(port, theCookie) {
        var domainCookies = this.sessionCookies[theCookie['domain']] || {};
        this.sessionCookies[theCookie['domain']] = domainCookies;

        var pathCookies = domainCookies[theCookie['path']] || {};
        domainCookies[theCookie['path']] = pathCookies;

        pathCookies[theCookie['name']] = {
            url: theCookie['url'],
            cookieData: theCookie['cookieData']
        };

        this.broadcastCookieUpdate(port, theCookie);
    },

    deleteSessionCookie: function(port, theCookie) {
        var domainCookies = this.sessionCookies[theCookie['domain']];
        if (!domainCookies)
            return;

        var pathCookies = domainCookies[theCookie['path']];
        if (!pathCookies)
            return;

        var cookieInfo = pathCookies[theCookie['name']];
        if (!cookieInfo)
            return;

        // Remove this session cookie
        delete pathCookies[theCookie['name']];

        // And broadcast this update so other helpers to remove the session cookie
        // or update it to a persistent cookie if it didn't expire.  Let IE figure
        // that out.
        this.broadcastCookieUpdate(port, theCookie);
    },

    updateCookie: function(port, theCookie) {
        var l = document.createElement('a');
        l.href = theCookie['url'];

       if (!theCookie['domain']) {
            theCookie['domain'] = l.host;
        }
        if (!theCookie['path']) {
            theCookie['path'] = l.pathname;
        }

        // We are only interested in session cookies.  You can tell a session cookie because it has
        // no expires attribute.  If a cookie that matches a session cookie now has an expires attribute
        // then it is either being deleted or being converted to persistent.  In either case, for our
        // purposes it is no longer a session cookie so we delete it and notify other processes of the
        // change.
        if (theCookie['expires'])
            this.deleteSessionCookie(port, theCookie);
        else
            this.updateSessionCookie(port, theCookie);
     },

    onNewCookieFromIE: function(port, url, cookieData) {
        var parts = cookieData.split(';');
        var attr, attrData;
        var theCookie = {};
        var j;
        var split;

        split = parts[0].split('=');

        theCookie['url'] = url;
        theCookie['cookieData'] = cookieData;
        theCookie['name'] = split[0].trim();
        theCookie['value'] = (split.length > 1) ? split[1] : null;

        for (var i=1; i<parts.length; i++) {
            attr = parts[i];
            j = attr.indexOf('=');
            if (j != -1) {
                attrData = attr.substr(j+1);
                attr = attr.substr(0, j);
            } else {
                attrData = null;
            }
            attr = attr.trim().toLowerCase();
            theCookie[attr] = attrData;
        }

        this.updateCookie(port, theCookie);
    }
}
