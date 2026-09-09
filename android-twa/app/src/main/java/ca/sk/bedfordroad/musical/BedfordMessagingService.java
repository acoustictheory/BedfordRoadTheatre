package ca.sk.bedfordroad.musical;

import android.app.*;
import android.content.*;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.Executors;

public class BedfordMessagingService extends FirebaseMessagingService {
    private static final String ENDPOINT="https://northamerica-northeast2-brpa-digital-hub-dev.cloudfunctions.net/registerCommunicationDevice";
    @Override public void onNewToken(String token){registerToken(this,token);}
    public static void registerToken(Context context,String token){
        String id=context.getSharedPreferences("bedford_messaging",MODE_PRIVATE).getString("install_id",null);
        if(id==null){id=UUID.randomUUID().toString();context.getSharedPreferences("bedford_messaging",MODE_PRIVATE).edit().putString("install_id",id).apply();}
        final String install=id;
        Executors.newSingleThreadExecutor().execute(()->{try{HttpURLConnection c=(HttpURLConnection)new URL(ENDPOINT).openConnection();c.setRequestMethod("POST");c.setRequestProperty("Content-Type","application/json");c.setDoOutput(true);byte[] body=("{\"installId\":\""+install+"\",\"token\":\""+token+"\"}").getBytes(StandardCharsets.UTF_8);try(OutputStream out=c.getOutputStream()){out.write(body);}c.getResponseCode();c.disconnect();}catch(Exception ignored){}});
    }
    @Override public void onMessageReceived(RemoteMessage remote){Map<String,String>d=remote.getData();if(!"communication".equals(d.get("type")))return;showConversation(d);}
    private void showConversation(Map<String,String>d){
        String conversation=or(d.get("conversationId"),"inbox"),title=or(d.get("conversationTitle"),"Bedford Musical"),sender=or(d.get("senderName"),"New message"),body=or(d.get("body"),"New message");
        String channelId="bedford_conversation_"+conversation.replaceAll("[^A-Za-z0-9_-]","_");
        NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=new NotificationChannel(channelId,title,NotificationManager.IMPORTANCE_HIGH);channel.setDescription("Messages from "+title);channel.setAllowBubbles(true);manager.createNotificationChannel(channel);}
        Uri uri=Uri.parse("https://bedfordroadtheatre.ca/communications.html?source=installed&conversation="+Uri.encode(conversation));
        Intent open=new Intent(this,LauncherActivity.class).setAction(Intent.ACTION_VIEW).setData(uri).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending=PendingIntent.getActivity(this,conversation.hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Person person=new Person.Builder().setName(sender).setKey(sender).build();
        NotificationCompat.MessagingStyle style=new NotificationCompat.MessagingStyle(person).setConversationTitle(title).setGroupConversation(true).addMessage(body,System.currentTimeMillis(),person);
        NotificationCompat.Builder builder=new NotificationCompat.Builder(this,channelId).setSmallIcon(R.drawable.ic_notification_icon).setContentTitle(title).setContentText(body).setStyle(style).setContentIntent(pending).setAutoCancel(true).setCategory(Notification.CATEGORY_MESSAGE).setPriority(NotificationCompat.PRIORITY_HIGH);
        if(Build.VERSION.SDK_INT>=29 && !"false".equals(d.get("bubbles"))){
            ShortcutManager sm=getSystemService(ShortcutManager.class);String shortcutId="conversation_"+conversation;
            ShortcutInfo shortcut=new ShortcutInfo.Builder(this,shortcutId).setShortLabel(title).setLongLived(true).setIcon(Icon.createWithResource(this,R.mipmap.ic_launcher)).setIntent(open).build();sm.pushDynamicShortcut(shortcut);
            NotificationCompat.BubbleMetadata bubble=new NotificationCompat.BubbleMetadata.Builder(pending,IconCompat.createWithResource(this,R.mipmap.ic_launcher)).setDesiredHeight(720).setAutoExpandBubble(true).setSuppressNotification(false).build();builder.setBubbleMetadata(bubble).setShortcutId(shortcutId);
        }
        manager.notify(conversation.hashCode(),builder.build());
    }
    private static String or(String value,String fallback){return value==null||value.isEmpty()?fallback:value;}
}
