/*
 *  Google Analytics Tracking of extension data and events
 */

if (typeof(window._gaq) == 'undefined')
    window._gaq = [];
window._gaq.push(['_setAccount', 'UA-31072207-1']);

var GATracking = {
    FIRSTRUN_KEY: "GATrackingFirstRun",
    DAILYLASTHIT_KEY: "GATrackingDailyLastHit",
    ONEDAY_MS: 86400000,
    _category: 'IE Tab Events',

    init: function(onDailyPing) {
        // Set up the account
        this._onDailyPing = onDailyPing;

        // Universal GA initialization
        (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
            (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
        m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
        })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
        ga('create', 'UA-1634107-7', 'auto');
        ga('set', 'checkProtocolTask', function() {});
        ga('require', 'displayfeatures');

        this._checkDailyPing();
    },

    trackEvent: function(action, label, value) {
        // Log even to Analytics, once done, go to the link
        ga('send', 'event', this._category, action, label, value);
    },

    trackEvents: function(arrEvents) {
        var arrCommands = [];
        for(var i=0; i<arrEvents.length; i++) {
            this.trackEvent(arrEvents[i].action, arrEvents[i].label, arrEvents[i].value);
        }
    },

    _getDayString: function(time) {
        var date = new Date(time);
        return date.getFullYear() + '-' + (date.getMonth()+1) + '-' + date.getDate();
    },


    _checkDailyPing: function() {
        var now = (new Date()).getTime();
        var thisDay = this._getDayString(now);

        var lastHit = localStorage[this.DAILYLASTHIT_KEY];
        lastHit = lastHit ? JSON.parse(lastHit) : 0;
        var lastDay = this._getDayString(lastHit);
        if(thisDay != lastDay) {
            localStorage[this.DAILYLASTHIT_KEY] = JSON.stringify(now);

            if(this._onDailyPing)
                this._onDailyPing();
        }

        // Check back in 1 hour
        window.setTimeout(function() {
            this._checkDailyPing();
        }.bind(this), 3600 * 1000);
    }
}