declare module 'html5-qrcode' {
  export class Html5Qrcode {
    constructor(elementId: string);
    start(
      config: { facingMode: string },
      options: {
        fps: number;
        qrbox: { width: number; height: number };
        aspectRatio: number;
      },
      onSuccess: (decodedText: string) => void,
      onFailure: () => void,
    ): Promise<void>;
  }
}
