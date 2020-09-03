# HuaweiCloud API(Nodejs)

* Base on huaweicloud api
* Write for personal account
* All personal info, such as: `username` & `user password` is store in `ENV`

## How to use?
1. store your user information in ENV via using `export`, for example: `export HWC_NAME="233" && export HWC_PASSWORD="233"`
2. See: [https://iitii.github.io/huaweicloud_cdn/](https://iitii.github.io/huaweicloud_cdn/)

## Example

```javascript
let token = await getToken();
let cdn_re = await cdn_preheatingtasks('link',
  token.x_subject_token)
let cdn_refresh = await cdn_refreshtasks('link', token.x_subject_token);
let detail1 = await showHistoryTaskDetails(token.x_subject_token, cdn_refresh.body.refreshTask.id)
console.log(cdn_re)
console.log(cdn_refresh)
console.log(cdn_refresh.body)
console.log(detail1)
console.log(detail1.body)
waitForRefreshTaskDone(token.x_subject_token, detail1.body.id)
  .then((res) => {
    console.log(res)
  }).then((res) => {
  console.log(res)
})
  .catch(e => {
    console.log(e)
  })
cdn_preheating(token.x_subject_token, ['link'])
  .then(r => {
    console.log(r)
  })
  .catch(e => {
    console.log(e)
  })
```