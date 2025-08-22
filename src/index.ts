import { createGrpcClient } from "./grpc/client";
import { watchAccounts } from "./grpc/watchRequest";
import { sendSubscribeRequest, handleStreamEvents } from "./grpc/stream";
import { RPC_URL, YELLOWSTONE_URL } from "./utils";

const trackedAccounts:string[] = [
  "9Ewf68xkFF93cx67owmEt6Fr7SEyqU972ZKyGh3gfZnE",
  "BbwF4wSwmxMVp7xubA7qigCUU6RMcvK2soMu8VrDHjDH",
  "AUQEE2GnSEoGnyFDbukwRoaDRPpK6S5ze8vf1Xh7NAi4",
];

/*  [
  "BbwF4wSwmxMVp7xubA7qigCUU6RMcvK2soMu8VrDHjDH",//  Someones axiom account
  "AUQEE2GnSEoGnyFDbukwRoaDRPpK6S5ze8vf1Xh7NAi4", // Random axiom account
  "9Ewf68xkFF93cx67owmEt6Fr7SEyqU972ZKyGh3gfZnE", // Another random axiom account
],*/

function envCheck(){
  if(!YELLOWSTONE_URL || !RPC_URL){ 
    throw new Error("Missing YELLOWSTONE_URL or RPC_URL in .env");
  }
}
async function main() {
  envCheck();
  const client = createGrpcClient();
  const stream = await client.subscribe();
  const request = watchAccounts(trackedAccounts);
  
  try {
    await sendSubscribeRequest(stream, request);
    console.log("Subscribed to Accounts ---- ✔️ ----");
    await handleStreamEvents(stream);
  } catch (error) {
    console.error("Couldnt Subscribe to accounts ! :", error);
    stream.end();
  }
}

main();
