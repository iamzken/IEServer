package com.iamconan.socket;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;

public class IEServer {
	
	public static void main(String[] args){
		
	    int port = 8989;
	    ServerSocket serverSocket = null;
	    BufferedWriter out = null;
	    Socket clientSocket = null;
	    boolean open = true;
		try {
			serverSocket = new ServerSocket(port);
			String url = null;
			while (true) {
				clientSocket = serverSocket.accept();
				BufferedReader in = null; 
				in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream())); 
                String data = in.readLine(); 
                while (data != null) { 
                	data = URLDecoder.decode(data, "UTF-8"); 
                    if (data.startsWith("GET")) { 
                        String uri = data.split(" ")[1];
                        if(uri.equals("/favicon.ico")){
                        	open = false;
                        	break;
                        }
                        open = true;
                        String params = uri.split("\\?")[1]; 
                        String[] paramArray = params.split("&"); 
                        url = paramArray[0].split("=")[1]; 
                        System.out.println("url=" + url); 
                        break;
                    } 
                }
   
				if(open){
					
					out = new BufferedWriter(new OutputStreamWriter(clientSocket.getOutputStream()));
					out.write("HTTP/1.0 200 OK\r\n");
					out.write("\r\n");
					out.write("<TITLE>IEServer</TITLE>");
					out.write("SUCCESS");
					out.close();
					clientSocket.close();
					String ieLocation = "C:\\Program Files\\Internet Explorer\\iexplore.exe";
					ProcessBuilder builder = new ProcessBuilder(ieLocation,url);
					Process process = builder.start();
					try{
						process.getErrorStream().close();  
						process.getInputStream().close();  
						process.getOutputStream().close();
					}catch(Exception e){
						e.printStackTrace();
					}
				}
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
	
	}
}