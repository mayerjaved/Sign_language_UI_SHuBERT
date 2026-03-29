export type Message = {
    id: string;
    sender: "user" | "bot";
    type: "text" | "video" | "avatar";
    content: string; // text string or Object URL for video blob
    language: string;
    timestamp: Date;
    isTranslating?: boolean;
    senderLabel?: string;
    statusTag?: string;
};

export type SignLanguage = "ASL" | "TRSL" | "PSL";
