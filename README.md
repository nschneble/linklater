# Linklater
A del.icio.us reinterpretation of Instapaper.

![Richard Linklater](https://github.com/user-attachments/assets/7bd86236-50ba-46dd-9da8-265cda79ff26)
_Source: [Bryan Berlin](https://commons.wikimedia.org/w/index.php?curid=176305476)_

## Bookmarklet

```js
javascript:(function(){
  const base = 'http://localhost:5173';
  const url = encodeURIComponent(location.href);
  const title = encodeURIComponent(document.title);
  window.open(`${base}/?url=${url}&title=${title}`, '_blank','noopener,noreferrer');
})();
```
