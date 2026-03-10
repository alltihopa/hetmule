/*

HETMULE

Ett js-bibliotek

- ladda get-parametrar

- sätt upp dom
- stoppa in i dom
- rensa i dom

smart sätt att ladda "sidor" och "komponenter"
- ladda sida, gå till sida


- polla
- pollkö
- sätt upp dom från data

- skapa "historiepunkt"


- fullskärm

*/

var model = {};

var plan = {};




window.onload = function() {
  
  console.info('Initial load');
  
  //läs in data från parametrar
  
  loadParametersIntoModel();
  
  perform ('H_start');
  
}

function perform (task, options = {}) 
{
  //gör nånting med modellen, eller med servern
  //t.ex. ta mig till en ny "sida"
  
  if (!task.startsWith('H_')) {
    
    return false;
    
  }
  
  if (options.event) {
    
    options.event.preventDefault();
    
  }
  
  if (typeof window[task] !== 'function') {
    
    console.warn('Task "' + task + '" is unknown.');
    
    return false;
    
  }
  
  console.info('Performing task "' + task + '"');
    
  window[task](options);
  
}
 

function loadParametersIntoModel ()
{
  
  const params = new URLSearchParams(window.location.search);
  
  for (const [key, value] of params) {
    
    model[key] = value;
    
  }
  
}

function checkpoint (url='/') 
{
  
  const state = { page_id: 1, user_id: 5 };
  url = 'hello-world.html';

  history.pushState(state, '', url);
  
}

function openFullscreen () 
{
  
  var elem = document.documentElement;
  
  if (elem.requestFullscreen) {
    
    elem.requestFullscreen();
    
  } else if (elem.webkitRequestFullscreen) { /* Safari */
  
    elem.webkitRequestFullscreen();
    
  } else if (elem.msRequestFullscreen) { /* IE11 */
  
    elem.msRequestFullscreen();
    
  }
  
  
}

function closeFullscreen () 
{
  
  if (document.exitFullscreen) {
    
    document.exitFullscreen();
    
  } else if (document.webkitExitFullscreen) { /* Safari */
  
    document.webkitExitFullscreen();
    
  } else if (document.msExitFullscreen) { /* IE11 */
  
    document.msExitFullscreen();
    
  } 
  
}

function follow (options = {})
{
  //följ plan, synkront/asynkront
/*  
  for (var p in plan) {
    
    if (!plan[p].task) {
      
      continue;
      
    }
    
    var params = {};
    
    if (plan[p].params) {
      
      params = plan[p].params;
      
    }
    
    perform (plan[p].task, params);
    
  }
  */
}

function poll (url, options = {}) 
{
  
  
}

function load (filepath, options = {}) 
{
  
  console.log('load: ', filepath);
  
  request (filepath, {
      'method' : 'get',
      'to' : model
  });
  
}


async function request (url, options = {}) 
{
  
  const method = options.method || 'HEAD';
  
  const res = await fetch(url, {
    
    method,
    
    body: options.payload ? JSON.stringify(options.payload) : undefined
    
  });
  
  const data = await res.json();
  
  if (options.to) Object.assign(options.to, data);
  
  if (options.callback) options.callback(data);
  
  return data;
  
}

  /*
function request (url, options={}) 
{
  

  method = 
  payload =
  callback =
  syncron =
  model =
  success =
  fail =
  
 
  var xhttp = new XMLHttpRequest();
    
  console.log('request', options);
  
  xhttp.onreadystatechange = function () {
      
    if (this.readyState == 4) {
            
      if (options.callback) {
          
        options.callback(xhttp.response);
          
      }
      
      if (options.to) {
        
        const parsed = JSON.parse(xhttp.response);
        
        Object.assign(options.to, parsed);
        
      }
      
    }
      
  };
  
  if (!options.async) {
    
    options.async = true;
    
  }
  
  if (options.method) {
  
    xhttp.open(options.method, url, options.async);
  
  } else {
    
    xhttp.open('HEAD', url, options.async);
    
  }
  
  if (options.payload) {
    
    xhttp.send(options.payload);
    
  } else {
    
    xhttp.send(null);
    
  }

}
 */
function dom (tag=false, parent_node=false, options={}) 
{
  
  if (!tag) {
    
    return false;
    
  }
  
  if (!parent_node) {
    
    return false;
    
  }
  
  if (tag == 'comment') {
        
    const node = document.createComment(options.text || '');
    
    parent_node.appendChild(node);
    
    return node;
    
  }
  
  if (options.namespace) {
    
    var node = document.createElementNS(options.namespace, tag);
    
  } else {
    
    var node = document.createElement(tag);
    
  }
  
  if (options.text) {
    
    const text_node = document.createTextNode(options.text);
    
    node.appendChild(text_node);
    
  }
  
  if (options.attributes) {
    
    for (let i in options.attributes) {
      
      node.setAttribute(i, options.attributes[i]);
      
    }
    
  }
  
  if (options.style) {
    
    for (let s in options.style) {
      
      node.style[s] = options.style[s];
      
    }
    
  }
  
  if (options.children) {
    
    for (let c in options.children) {
      
      const child_tag = options.children[c].tag || tag;
      
      dom (child_tag, node, options.children[c]);
      
    }
    
  }
  
  if (options.before) {
    
    parent_node.insertBefore(node, options.before);
    
    return node;
    
  }
  
  parent_node.appendChild(node);
  
  return node;
  
}



// EOF