export const MICROSERVICE_ICONS: Record<string, string> = {
  api: "/icons/microservices/api.svg",
  web: "/icons/microservices/web.svg",
  "ocean-core": "/icons/microservices/ocean-core.svg",
  alba: "/icons/microservices/alba.svg",
  albi: "/icons/microservices/albi.svg",
  jona: "/icons/microservices/jona.svg",
  asi: "/icons/microservices/asi.svg",
  excel: "/icons/microservices/excel.svg",
  kitchen: "/icons/microservices/kitchen.svg",
  postman: "/icons/microservices/postman.svg",
};

export function getMicroserviceIcon(serviceName: string): string {
  const normalized = serviceName.toLowerCase().trim();

  if (MICROSERVICE_ICONS[normalized]) {
    return MICROSERVICE_ICONS[normalized];
  }

  if (normalized.includes("api")) return MICROSERVICE_ICONS.api;
  if (normalized.includes("web")) return MICROSERVICE_ICONS.web;
  if (normalized.includes("ocean")) return MICROSERVICE_ICONS["ocean-core"];
  if (normalized.includes("alba") || normalized.includes("analytical")) return MICROSERVICE_ICONS.alba;
  if (normalized.includes("albi") || normalized.includes("creative")) return MICROSERVICE_ICONS.albi;
  if (normalized.includes("jona") || normalized.includes("coordinator")) return MICROSERVICE_ICONS.jona;
  if (normalized.includes("asi")) return MICROSERVICE_ICONS.asi;
  if (normalized.includes("excel")) return MICROSERVICE_ICONS.excel;
  if (normalized.includes("kitchen")) return MICROSERVICE_ICONS.kitchen;
  if (normalized.includes("postman")) return MICROSERVICE_ICONS.postman;

  return "/icons/microservices/service-default.svg";
}
