
var editor,output,active_scheme = {};

function autocomplete(editor) {
  var tokenPath = getCurrentTokenPath(editor);
  var autoCompleteRules = active_scheme.autocomplete_rules || {};
  console.log("Starting auto complete for path: " + tokenPath + " options: " + autoCompleteRules[tokenPath]);
  if (!autoCompleteRules[tokenPath]) return; // nothing to do..


  var pos = editor.getCursorPosition();
  var session = editor.getSession();
  var currentToken = session.getTokenAt(pos.row,pos.column);
  var tokenRange = new (ace.require("ace/range").Range)(pos.row,currentToken.start,pos.row,
                                                        currentToken.start + currentToken.value.length);
  var cursor = $(".ace_cursor");
  var offset = cursor.offset();
  var ac_input = $('<input id="autocomplete" type="text" data-provide="typeahead" />').appendTo($("#main"));
  ac_input.css("left",offset.left);
  ac_input.css("top",offset.top);
  if (currentToken.type == "string" || currentToken.type == "variable") // string with current token
    ac_input.val(currentToken.value.trim().replace(/"/g,''));
  else
    ac_input.val();

  ac_input.css('visibility', 'visible');
  ac_input.typeahead({
    minLength : 0,
    source : autoCompleteRules[tokenPath],
    updater : function (item) {
      switch (currentToken.type) {
        case "paren.rparen":
          editor.insert(', "'+item+'"');
          break;
        case "string":
        case "variable":
          session.replace(tokenRange,'"'+item+'"');
          break;
        default:
          editor.insert('"'+item+'"');
      }

      ac_input.remove();
      editor.focus();
    }
  });
  ac_input.blur(function () {ac_input.css('visibility','hidden'); ac_input.remove()});

  ac_input.focus();
}


function getCurrentTokenPath(editor) {
  var pos = editor.getCursorPosition();
  var tokenIter = new (ace.require("ace/token_iterator").TokenIterator)(editor.getSession(),pos.row,pos.column);
  var ret = "", last_var = "";
  for (var t = tokenIter.getCurrentToken();t; t = tokenIter.stepBackward()) {
    switch (t.type) {
      case "paren.lparen":
          if (!ret) {
            // bottom of the chain, last var is not part of path.
            ret = t.value;
          }
          else
            ret = t.value + last_var + ret;

        last_var = "";
        break;
      case "paren.rparen":
          var parenCount =1;
          for (t = tokenIter.stepBackward(); t && parenCount > 0 ; t = tokenIter.stepBackward()) {
            switch (t.type) {
              case "paren.lparen":
                parenCount--;
                break;
              case "paren.rparen":
                parenCount++;
                break;
            }
          }
          if (!t) // oops we run out.. we don't what's up return null;
            return null;
        break;
      case "string":
      case "constant.numeric" :
      case "variable":
        if (!last_var) {
          last_var = t.value.trim().replace(/"/g,'');
        }
        break;
    }
  }
  return ret;
}

function updateActiveScheme(endpoint) {
  for (var scheme_endpoint in ES_SCHEME_BY_ENDPOINT) {
      if (endpoint.indexOf(scheme_endpoint) == 0) {
        endpoint = scheme_endpoint;
        break;
      }
    }

  active_scheme = ES_SCHEME_BY_ENDPOINT[endpoint];

}

function callES() {
  output.getSession().setValue('{ "__mode__" : "Calling ES...." }');

 var es_host = $("#es_host").val(),
     es_path = $("#es_path").val(),
     es_method = $("#es_method").val();

  if (es_host.indexOf("://") <0 ) es_host = "http://" + es_host;
  es_host = es_host.trim("/");

  if (es_path[0] !='/') es_path = "/" + es_path;

  console.log("Calling " + es_host+es_path);
  $.ajax({
     url : es_host + es_path,
     data : editor.getValue(),
     type: es_method,
     complete: function (xhr,status) {
       if (status == "error" || status == "success") {
         var value = xhr.responseText;
         try {
            value = JSON.stringify(JSON.parse(value), null, 3);
         }
         catch (e) {

         }
         output.getSession().setValue(value);
       }
       else {
         output.getSession().setValue("Request failed to get to the server: " + status);
       }

     }
  })
}

function reformat() {
  var value = editor.getSession().getValue();
  try {
     value = JSON.stringify(JSON.parse(value), null, 3);
     editor.getSession().setValue(value);
  }
  catch (e) {

  }

}

function init () {
  editor = ace.edit("editor");
  editor.getSession().setMode("ace/mode/json");
  editor.getSession().setFoldStyle('markbeginend');
  editor.commands.addCommand({
      name: 'autocomplete',
      bindKey: {win: 'Ctrl-Space',  mac: 'Ctrl-Space'},
      exec: autocomplete
  });
  editor.commands.addCommand({
      name: 'reformat editor',
      bindKey: {win: 'Ctrl-I',  mac: 'Command-I'},
      exec: reformat
  });
  output = ace.edit("output");
  output.getSession().setMode("ace/mode/json");
  output.getSession().setFoldStyle('markbeginend');
  output.setTheme("ace/theme/monokai");
  output.setReadOnly(true);

  reformat();
  editor.focus();


  $("#es_host").val(window.location.host);
  var paths = [];
  for (var endpoint in ES_SCHEME_BY_ENDPOINT) {
    paths.push(endpoint);
  }
  paths.sort();


  var es_path = $("#es_path");
  es_path.typeahead({ "source" : paths });

  es_path.change(function () {
    updateActiveScheme(es_path.val());
  });

  es_path.change(); // initialized using baked in value.
}

$(document).ready(init);
