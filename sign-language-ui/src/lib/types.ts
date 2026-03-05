export type Message = {
    id: string;
    sender: 'user' | 'bot';
    type: 'text' | 'video';
    content: string; // text string or Object URL for video blob
    language: string;
    timestamp: Date;
    isTranslating?: boolean;
};

export type SignLanguage = "ASL" | "TRSL" | "PSL";
