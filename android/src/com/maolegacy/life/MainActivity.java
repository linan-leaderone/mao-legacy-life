package com.maolegacy.life;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InterruptedIOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/** A bundled, offline-first WebView. Only the bundled game can access NativeBridge. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final int SAVE_REQUEST = 101, OPEN_REQUEST = 102;
    private WebView webView;
    private String pendingSave;
    private ValueCallback<Uri[]> fileCallback;
    private final ExecutorService apiExecutor=Executors.newFixedThreadPool(3);
    private final ScheduledThreadPoolExecutor apiTimeouts=new ScheduledThreadPoolExecutor(1);
    private final ConcurrentHashMap<String, ApiTask> apiTasks=new ConcurrentHashMap<>();
    private volatile boolean destroyed;
    private static final Set<String> API_HEADERS=new HashSet<>(Arrays.asList("authorization","x-goog-api-key","x-api-key","anthropic-version","anthropic-beta","anthropic-dangerous-direct-browser-access","content-type","accept"));

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        apiTimeouts.setRemoveOnCancelPolicy(true);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(16, 19, 16));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(16, 19, 16));
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.requestApplyInsets();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // System file picker is used for importing a save.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        WebView.setWebContentsDebuggingEnabled(false);
        webView.addJavascriptInterface(new SaveBridge(), "NativeBridge");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isLocal(request.getUrl());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!HOST.equals(uri.getHost())) return null;
                String asset = uri.getPath();
                if (asset == null || asset.equals("/")) asset = "/index.html";
                if (asset.contains("..") || asset.contains("\\")) return missing();
                try {
                    InputStream stream = getAssets().open("web" + asset);
                    return new WebResourceResponse(mime(asset), "UTF-8", 200, "OK",
                        Collections.singletonMap("Cache-Control", "no-cache"), stream);
                } catch (Exception error) { return missing(); }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                                       FileChooserParams parameters) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                try { startActivityForResult(intent, OPEN_REQUEST); }
                catch (Exception error) { fileCallback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
            @Override public boolean onJsConfirm(WebView view, String url, String message, android.webkit.JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("确定", (dialog, which) -> result.confirm())
                    .setNegativeButton("取消", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
        });
        webView.loadUrl("https://" + HOST + "/index.html");
    }

    private static boolean isLocal(Uri uri) { return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()); }
    private boolean isGamePage() { String url=webView==null?null:webView.getUrl();return url!=null&&isLocal(Uri.parse(url)); }
    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(),
            new ByteArrayInputStream(new byte[0]));
    }
    private static String mime(String asset) {
        if (asset.endsWith(".html")) return "text/html";
        if (asset.endsWith(".js") || asset.endsWith(".mjs")) return "application/javascript";
        if (asset.endsWith(".css")) return "text/css";
        if (asset.endsWith(".json")) return "application/json";
        if (asset.endsWith(".svg")) return "image/svg+xml";
        if (asset.endsWith(".png")) return "image/png";
        if (asset.endsWith(".webp")) return "image/webp";
        if (asset.endsWith(".jpg") || asset.endsWith(".jpeg")) return "image/jpeg";
        if (asset.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }
    public final class SaveBridge {
        @JavascriptInterface public void requestApi(String raw) {
            if(raw==null||raw.length()>600000)return;
            String id="";
            try{
                JSONObject request=new JSONObject(raw);id=request.getString("id");
                if(!id.matches("[a-zA-Z0-9._-]{1,100}")||destroyed)return;
                final ApiTask task=new ApiTask(id,request);
                // Register before returning to JavaScript: a following cancel must see this task,
                // even while the origin check is waiting for the UI thread.
                if(apiTasks.putIfAbsent(id,task)!=null)return;
                runOnUiThread(()->{
                    if(destroyed||!isGamePage()||task.cancelled){apiTasks.remove(task.id,task);task.cancel();return;}
                    try{
                        task.attachDeadline(apiTimeouts.schedule(()->{
                            if(apiTasks.remove(task.id,task)){task.cancel();apiReply(task.id,apiError());}
                        },task.timeoutMs,TimeUnit.MILLISECONDS));
                        task.attachFuture(apiExecutor.submit(task));
                    }catch(Exception error){apiTasks.remove(task.id,task);task.cancel();apiReply(task.id,apiError());}
                });
            }catch(Exception error){apiReply(id,apiError());}
        }
        @JavascriptInterface public void cancelApi(String id) {
            if(id==null)return;
            ApiTask task=apiTasks.remove(id);if(task!=null)task.cancel();
        }
        @JavascriptInterface public void saveText(String filename, String content) {
            if (content == null || content.length() > 10000000) return;
            runOnUiThread(() -> {
                if (destroyed || !isGamePage() || pendingSave != null) return;
                pendingSave = content;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, filename == null ? "人生档案.json" : filename.replaceAll("[/\\\\]", "_"));
                try { startActivityForResult(intent, SAVE_REQUEST); }
                catch (Exception error) { pendingSave = null; Toast.makeText(MainActivity.this, "无法打开保存位置", Toast.LENGTH_LONG).show(); }
            });
        }
    }
    private static JSONObject apiError(){JSONObject result=new JSONObject();try{result.put("error","无法完成 API 请求，请检查网络和服务地址。");}catch(Exception ignored){}return result;}
    private void apiReply(String id,JSONObject result){
        runOnUiThread(()->{
            if(!destroyed&&!isFinishing()&&isGamePage())
                webView.evaluateJavascript("window.__maoApiResponse && window.__maoApiResponse("+JSONObject.quote(id)+","+result.toString()+")",null);
        });
    }
    private final class ApiTask implements Runnable {
        final String id;final JSONObject request;final int timeoutMs;volatile boolean cancelled,finished;volatile HttpURLConnection connection;volatile Future<?> future,deadline;
        ApiTask(String id,JSONObject request){this.id=id;this.request=request;double requested=request.optDouble("timeoutMs",60000);timeoutMs=Double.isNaN(requested)||Double.isInfinite(requested)?60000:(int)Math.max(1000,Math.min(180000,Math.round(requested)));}
        void attachFuture(Future<?> value){future=value;if(cancelled)value.cancel(true);}
        void attachDeadline(Future<?> value){deadline=value;if(cancelled||finished)value.cancel(false);}
        void cancel(){cancelled=true;if(deadline!=null)deadline.cancel(false);if(future!=null)future.cancel(true);if(connection!=null)connection.disconnect();}
        void ensureActive() throws InterruptedIOException {if(cancelled||destroyed||Thread.currentThread().isInterrupted())throw new InterruptedIOException();}
        @Override public void run(){
            JSONObject result=apiError();
            try{
                ensureActive();
                URL url=new URL(request.getString("url"));
                boolean local=Arrays.asList("localhost","127.0.0.1","[::1]","::1").contains(url.getHost());
                if((!url.getProtocol().equals("https")&&!(url.getProtocol().equals("http")&&local))||url.getUserInfo()!=null||url.getRef()!=null)throw new IllegalArgumentException();
                String method=request.optString("method","GET"),body=request.optString("body","");
                if((!method.equals("GET")&&!method.equals("POST"))||body.length()>524288)throw new IllegalArgumentException();
                connection=(HttpURLConnection)url.openConnection();connection.setInstanceFollowRedirects(false);
                ensureActive();
                connection.setConnectTimeout(timeoutMs);connection.setReadTimeout(timeoutMs);connection.setRequestMethod(method);
                JSONObject headers=request.optJSONObject("headers");
                if(headers!=null)for(Iterator<String> keys=headers.keys();keys.hasNext();){String key=keys.next(),value=headers.getString(key);if(!API_HEADERS.contains(key.toLowerCase(java.util.Locale.ROOT))||value.length()>8192||value.contains("\r")||value.contains("\n"))throw new IllegalArgumentException();connection.setRequestProperty(key,value);}
                ensureActive();
                if(method.equals("POST")){connection.setDoOutput(true);byte[] bytes=body.getBytes(StandardCharsets.UTF_8);connection.setFixedLengthStreamingMode(bytes.length);ensureActive();try(OutputStream stream=connection.getOutputStream()){ensureActive();stream.write(bytes);}}
                ensureActive();
                int status=connection.getResponseCode();ByteArrayOutputStream output=new ByteArrayOutputStream();
                InputStream input=status>=200&&status<300?connection.getInputStream():null;
                if(input!=null)try(InputStream stream=input){byte[] buffer=new byte[8192];int size;while((size=stream.read(buffer))!=-1){ensureActive();if(output.size()+size>2097152)throw new IllegalStateException();output.write(buffer,0,size);}}
                result=new JSONObject();result.put("status",status);result.put("body",new String(output.toByteArray(),StandardCharsets.UTF_8));
            }catch(Exception ignored){result=apiError();}
            finally{finished=true;if(deadline!=null)deadline.cancel(false);if(connection!=null)connection.disconnect();apiTasks.remove(id,this);}
            if(!cancelled)apiReply(id,result);
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == OPEN_REQUEST && fileCallback != null) {
            fileCallback.onReceiveValue(result == RESULT_OK && data != null && data.getData() != null
                ? new Uri[] { data.getData() } : null);
            fileCallback = null;
        }
        if (request == SAVE_REQUEST) {
            if (result == RESULT_OK && data != null && data.getData() != null && pendingSave != null) {
                try (OutputStream stream = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    if (stream == null) throw new IllegalStateException("No output stream");
                    stream.write(pendingSave.getBytes(StandardCharsets.UTF_8));
                    Toast.makeText(this, "档案已保存", Toast.LENGTH_SHORT).show();
                } catch (Exception error) { Toast.makeText(this, "保存失败，请重试", Toast.LENGTH_LONG).show(); }
            }
            pendingSave = null;
        }
    }
    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else new AlertDialog.Builder(this).setMessage("离开这里？这段经历已保存在本机。")
            .setPositiveButton("退出", (dialog, which) -> finish()).setNegativeButton("继续", null).show();
    }
    @Override protected void onPause() { super.onPause(); webView.onPause(); }
    @Override protected void onResume() { super.onResume(); if (webView != null) webView.onResume(); }
    @Override protected void onDestroy() {
        destroyed=true;for(ApiTask task:apiTasks.values())task.cancel();apiTasks.clear();apiExecutor.shutdownNow();apiTimeouts.shutdownNow();
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        webView.removeJavascriptInterface("NativeBridge");
        webView.destroy();
        super.onDestroy();
    }
}
