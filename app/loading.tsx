import { LinearGradientReverse } from "@/components/linearGradientReverse";
import { Text } from "@/components/PoppinsText";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";

export default function Loading() {
  const router = useRouter();
  useEffect(() => {
    setTimeout(() => {
      router.replace("/home");
    }, 3000);
  });
  return (
    <View className="w-full h-full relative bg-white items-center justify-center flex flex-col">
      <Image
        source={require("../assets/images/loading.png")}
        resizeMode="contain"
        className="w-full h-full absolute"
      />
      <View className="absolute w-full h-10 flex items-center justify-center">
        <ActivityIndicator size="large" color="#ED6842" />
      </View>
      <Animated.View
        entering={FadeIn.duration(1000)}
        className="w-[60%] flex self-center h-1/2"
      >
        <Image
          source={require("../assets/images/logos/logo-white-vertical.png")}
          resizeMode="contain"
          className="w-full h-full"
        />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(1000)}
        className="w-full h-60 relative rounded-t-[35px] mt-auto overflow-hidden flex items-center justify-center "
      >
        <LinearGradientReverse />
        <View className="w-full h-full flex px-8 gap-2 flex-col items-center ">
          <Image
            source={require("../assets/images/platforms.png")}
            resizeMode="contain"
            className="w-[60%] "
          />
          <Text className="font-poppins-bold text-xl text-white text-center">
            A Inova Inteligência em Lubrificação está Inovando mais!
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
