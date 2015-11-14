var Slack = require('slack-client');
var jsonfile = require('jsonfile');
var logme = require('logme');
var file = 'meetings.json';
var token = 'xoxb-14361485399-xSoAKzwVzrl1UMzS9A5997ng';
var meetings = [];
require('./webpage.js');
jsonfile.readFile(file, function(err, obj){
    for(object in obj){
        meetings.push(obj[object]);
    }
});
var express = require('express');
var app = express();
app.get('/', function (req, res) {
  res.send(meetings);
  //this would go to a function that does react stuff to format a webpage
});

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  logme.info('Example app listening at http://'+host+':'+port);
});
var slack = new Slack(token, true, true);

var makeMention = function(userId) {
    return '<@' + userId + '>';
};
var isMention = function(string){
    return string.charAt(0)=="@";
}
var isDirect = function(userId, messageText) {
    var userTag = makeMention(userId);
    return messageText &&
           messageText.length >= userTag.length &&
           messageText.substr(0, userTag.length) === userTag;
};

var getOnlineHumansForChannel = function(channel) {
    if (!channel) return [];

    return (channel.members || [])
        .map(function(id) { return slack.users[id]; })
        .filter(function(u) { return !!u && !u.is_bot && u.presence === 'active'; });
};

slack.on('open', function () {
    var channels = Object.keys(slack.channels)
        .map(function (k) { return slack.channels[k]; })
        .filter(function (c) { return c.is_member; })
        .map(function (c) { return c.name; });

    var groups = Object.keys(slack.groups)
        .map(function (k) { return slack.groups[k]; })
        .filter(function (g) { return g.is_open && !g.is_archived; })
        .map(function (g) { return g.name; });

    console.log('Welcome to Slack. You are ' + slack.self.name + ' of ' + slack.team.name);

    if (channels.length > 0) {
        console.log('You are in: ' + channels.join(', '));
    }
    else {
        console.log('You are not in any channels.');
    }

    if (groups.length > 0) {
       console.log('As well as: ' + groups.join(', '));
    }
});

slack.on('message', function(message) {
    var channel = slack.getChannelGroupOrDMByID(message.channel);
    var user = slack.getUserByID(message.user);
    if (message.type === 'message' && isDirect(slack.self.id, message.text)) {
        var trimmedMessage = message.text.substr(makeMention(slack.self.id).length).trim();
        var args = trimmedMessage.split(' ');
        if(args[0]==":"){
            args.splice(0,1);
        }
        if(args[0]=="meeting"){
            if(!args[1]&&!args[2]&&!args[3]){
                channel.send("meeting (topic) (date) (location) (attendees)");
            } else {
                try{
                    var meeting={
                        'topic':args[1],
                        'date' : args[2],
                        'location' : args[3],
                        'attendees' : args[4].split(',')
                    } 
                }
                catch(err){
                    channel.send('fail');
                    return;
                }
                for (var x=0; x<meeting.attendees.length; x++){
                    if(isMention(meeting.attendees[x])){
                        meeting.attendees[x]=slack.getUserByID(meeting.attendees[x]).profile.real_name + "("+meeting.attendees[x]+")";
                    }
                }
                channel.send("Meeting scheduled. \n\t&gt;Topic: "+meeting.topic+", when: "+meeting.date+ ", where: "+meeting.location+ ", with: "+meeting.attendees);
                meetings.push(meeting);
                jsonfile.writeFile(file, meetings, {spaces:2},function(){});
                // console.log(meetings);
            }
        } else if(args[0]=="meetings"){
            if(!args[1]){
                // console.log(meetings);
                for(meetingNum in meetings){
                    meeting = meetings[meetingNum];
                    channel.send("Meeting "+(parseInt(meetingNum)+1).toString()+": \n\t&gt;Topic: "+meeting.topic+", when: "+meeting.date+ ", where: "+meeting.location+ ", with: "+meeting.attendees+'\n');
                }   
            }
            else if(args[1]=="clear"){
                meetings = []
                jsonfile.writeFile(file,meetings,function(err){});
                channel.send('Meetings cleared.');
            }
        }
    }
});

slack.login();