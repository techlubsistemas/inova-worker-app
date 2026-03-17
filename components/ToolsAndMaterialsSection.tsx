import { Text } from "@/components/PoppinsText";
import type { CipServiceInWorkOrder } from "@/types/workOrder";
import { View } from "react-native";

export function ToolsAndMaterialsSection({
  servicesList,
}: {
  servicesList: CipServiceInWorkOrder[];
}) {
  const hasToolkit = servicesList.some((s) => s.toolkit);
  const hasMaterials = servicesList.some(
    (s) => (s.cip?.subset?.set?.equipment?.materials?.length ?? 0) > 0
  );
  if (!hasToolkit && !hasMaterials) {
    return (
      <View className="border-b border-gray-200 pb-4">
        <Text className="text-secondary-400 text-xs font-poppins-bold uppercase">
          Ferramentas e materiais
        </Text>
        <Text className="text-secondary-500 mt-1">
          Nenhuma ferramenta ou material listado.
        </Text>
      </View>
    );
  }
  const uniqueToolkits = Array.from(
    new Map(
      servicesList
        .filter((s) => s.toolkit)
        .map((s) => [s.toolkit!.id, s.toolkit!])
    ).values()
  );
  const isSingleService = servicesList.length <= 1;
  return (
    <View className="border-b border-gray-200 pb-4">
      <Text className="text-secondary-400 text-xs font-poppins-bold uppercase">
        Ferramentas e materiais
      </Text>
      {uniqueToolkits.length > 0 && (
        <View className="mt-2">
          <Text className="text-primary-500 font-poppins-medium text-sm">
            Ferramentas
          </Text>
          {uniqueToolkits.map((tk, idx) => (
            <View key={tk.id + idx} className="mt-1 rounded-lg bg-gray-50 p-2">
              <Text className="text-primary-500">{tk.name}</Text>
              {tk.description ? (
                <Text className="text-secondary-500 text-sm mt-0.5">
                  {tk.description}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
      {hasMaterials && (
        <View className="mt-3">
          <Text className="text-primary-500 font-poppins-medium text-sm">
            Materiais
          </Text>
          {servicesList.map((s, idx) => {
            const equipment = s.cip?.subset?.set?.equipment;
            const materials = equipment?.materials ?? [];
            if (materials.length === 0) return null;
            return (
              <View key={s.id + idx} className="mt-1">
                {!isSingleService && (
                  <Text className="text-secondary-500 text-sm font-poppins-medium">
                    {s.serviceModel?.name ?? "Serviço"}
                  </Text>
                )}
                {materials.map((me, idx2) => (
                  <View
                    key={me.material.id + idx2}
                    className="rounded-lg bg-gray-50 p-2 mt-1 ml-0"
                  >
                    <Text className="text-primary-500">
                      {me.material.name}
                      </Text>
                    {(me.material.sku || me.volume != null || me.unit) && (
                      <Text className="text-secondary-500 text-sm mt-0.5">
                        {[me.material.sku, me.volume != null ? `Vol: ${me.volume}` : null, me.unit?.name]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
