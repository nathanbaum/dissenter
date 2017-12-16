function fetchThumbnails(thumbs, i){
  if(i >= thumbs.length) { return; }
  const req = new XMLHttpRequest();
  const thumb = thumbs[i];
  console.log(thumb);
  const key = '5a0f2b31e69342c28d223baab3f21a96ce4b643e18299';
  const linkpreview = 'http://api.linkpreview.net/?key=' + key + '&q=' + thumb.getAttribute('href');
  //console.log(linkpreview);
  req.open('GET', linkpreview, true);
  req.addEventListener('load', function() {
    if (req.status >= 200 && req.status < 400) {
      const res = JSON.parse(req.responseText);
      //console.log(document.createElement('h3'));
      //console.log(res);
      thumb.appendChild(
        document.createElement('h3')).textContent = res.title;
      thumb.appendChild(
        document.createElement('img')).src = res.image;
      thumb.appendChild(
        document.createElement('p')).textContent = res.description;
      thumb.addEventListener('click', function() { window.open(thumb.getAttribute('href')); });
    }
    fetchThumbnails(thumbs, i+1);
  });
  req.addEventListener('error', function(e) {
    thumb.appendChild(
      document.createElement('p')).
      textContent = e;
    fetchThumbnails(thumbs);
  });
  req.send();
}

function fetchCaller() {
  fetchThumbnails(document.getElementsByClassName('thumbnail'), 0);
}

document.addEventListener('DOMContentLoaded', fetchCaller);
