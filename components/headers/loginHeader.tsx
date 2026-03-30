import { Image, View } from "react-native";
import { LinearGradient } from "../linearGradient";
export function LoginHeader() {
  return (
    <View className="w-full h-80 relative rounded-b-[35px] overflow-hidden flex items-center justify-center ">
      <LinearGradient />
      <Image
        source={require("../../assets/images/logos/logo-white.png")}
        resizeMode="contain"
        className="w-full h-full"
      />
    </View>
  );
}
