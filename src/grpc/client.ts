import Client from "@triton-one/yellowstone-grpc";
import { YELLOWSTONE_URL } from "../utils";

export function createGrpcClient(): Client {
  console.log("Connecting to yellowstone grpc ----- ✔️ -----");
  return new Client(YELLOWSTONE_URL as unknown as string, undefined, undefined);
}
