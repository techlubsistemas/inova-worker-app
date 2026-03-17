import { useModal } from "@/context/modalContext";
import { ArrowLeft, Download } from "lucide-react-native";
import * as Linking from "expo-linking";
import { useMemo } from "react";
import { Dimensions, TouchableOpacity, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { WebView } from "react-native-webview";
import { Text } from "../PoppinsText";

type VideoSource =
  | { type: "embed"; uri: string }
  | { type: "embed-html"; embedUri: string }
  | { type: "html"; html: string };

/** Converte URL do YouTube/Vimeo em embed ou retorna vídeo direto (.mp4 etc). YouTube usa embed-html + baseUrl para evitar Error 153. */
function getVideoEmbedSource(url: string): VideoSource {
  try {
    const u = url.trim();
    // YouTube: watch?v=ID, youtu.be/ID ou embed/ID (com ou sem ?si=...)
    const ytWatchMatch = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    const ytEmbedMatch = u.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
    const ytId = ytWatchMatch?.[1] ?? ytEmbedMatch?.[1];
    if (ytId) {
      const embedUri = `https://www.youtube.com/embed/${ytId}`;
      return { type: "embed-html", embedUri };
    }
    // Vimeo: vimeo.com/ID
    const vimeoMatch = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      return { type: "embed", uri: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
    }
    // Vídeo direto: usar tag <video>
    const escaped = u.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#000"><video src="${escaped}" controls style="width:100%;height:100%;object-fit:contain"></video></body></html>`;
    return { type: "html", html };
  } catch {
    return { type: "html", html: "" };
  }
}

export function TutorialModal() {
  const { selectedTutorial, closeTutorialModal } = useModal();

  if (!selectedTutorial) return null;

  const isVideo = selectedTutorial.type === "video" && selectedTutorial.videoUrl;
  const isFile = selectedTutorial.type === "file" && selectedTutorial.fileUrl;

  const videoSource = useMemo(() => {
    if (!isVideo || !selectedTutorial.videoUrl) return null;
    return getVideoEmbedSource(selectedTutorial.videoUrl);
  }, [isVideo, selectedTutorial.videoUrl]);

  const handleOpenFile = () => {
    if (selectedTutorial.fileUrl) {
      Linking.openURL(selectedTutorial.fileUrl);
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      className="w-full h-full flex items-center bg-transparent justify-center absolute z-30"
    >
      <TouchableOpacity
        onPress={closeTutorialModal}
        className="w-full h-full absolute bg-black/60 z-10"
      />
      <Animated.View
        entering={SlideInDown.duration(300)}
        exiting={SlideOutDown.duration(300)}
        className="w-[90%] max-h-[85%] rounded-lg flex gap-4 p-4 py-6 flex-col border border-secondary-400 bg-white absolute z-20 overflow-hidden"
      >
        <View className="flex-row items-center">
          <View className="flex-1">
            <TouchableOpacity onPress={closeTutorialModal}>
              <ArrowLeft color="#182D53" size={28} />
            </TouchableOpacity>
          </View>
          <Text className="flex-1 text-primary-500 font-poppins-bold text-lg text-center" numberOfLines={2}>
            {selectedTutorial.name}
          </Text>
          <View className="flex-1" />
        </View>

        {selectedTutorial.description ? (
          <Text className="text-secondary-500 text-sm px-1">
            {selectedTutorial.description}
          </Text>
        ) : null}

        {isVideo && videoSource && (
          <View
            className="overflow-hidden bg-black"
            style={{
              width: Dimensions.get("window").width * 0.9,
              marginHorizontal: -16,
              aspectRatio: 16 / 9,
            }}
          >
            <WebView
              source={
                videoSource.type === "embed-html"
                  ? {
                      html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:0;width:100%;height:100%;background:#000;position:relative"><iframe src="${videoSource.embedUri}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></body></html>`,
                      baseUrl: "https://myapp.local",
                    }
                  : videoSource.type === "embed"
                    ? {
                        uri: videoSource.uri,
                        headers: { Referer: "https://myapp.local" },
                      }
                    : { html: videoSource.html }
              }
              style={{ flex: 1, backgroundColor: "black" }}
              scrollEnabled={false}
              allowsFullscreenVideo
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
            />
          </View>
        )}

        {isFile && (
          <TouchableOpacity
            onPress={handleOpenFile}
            className="flex-row items-center justify-center gap-2 rounded-lg bg-secondary-400 py-4 px-6"
          >
            <Download color="white" size={22} />
            <Text className="text-white font-poppins-bold">Baixar / Abrir arquivo</Text>
          </TouchableOpacity>
        )}

        {!isVideo && !isFile && (
          <Text className="text-secondary-500 text-sm">Conteúdo não disponível.</Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}
