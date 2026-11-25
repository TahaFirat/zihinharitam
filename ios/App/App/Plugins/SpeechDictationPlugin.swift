import Foundation
import AVFoundation
import Speech
import Capacitor

@available(iOS 15.0, *)
@objc(SpeechDictationPlugin)
public class SpeechDictationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechDictationPlugin"
    public let jsName = "SpeechDictation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var speechRecognizer: SFSpeechRecognizer?
    private var isListening = false
    private var latestTranscript = ""
    private var sessionToken: Int = 0

    deinit {
        tearDownAudio()
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "tr-TR")) ?? SFSpeechRecognizer()
        call.resolve([
            "available": recognizer?.isAvailable ?? false
        ])
    }

    @objc func start(_ call: CAPPluginCall) {
        let localeId = call.getString("locale") ?? "tr-TR"
        SFSpeechRecognizer.requestAuthorization { [weak self] authStatus in
            guard let self = self else { return }
            guard authStatus == .authorized else {
                call.reject("Konuşma tanıma izni verilmedi. Ayarlar > ZihinHaritam bölümünden izin verebilirsiniz.", "PERMISSION_DENIED")
                return
            }

            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                guard granted else {
                    call.reject("Mikrofon izni verilmedi. Ayarlar > ZihinHaritam bölümünden izin verebilirsiniz.", "MIC_DENIED")
                    return
                }

                DispatchQueue.main.async {
                    do {
                        try self.beginSession(localeId: localeId)
                        call.resolve(["listening": true])
                    } catch {
                        self.tearDownAudio()
                        call.reject("Dikte başlatılamadı: \(error.localizedDescription)", "START_FAILED")
                    }
                }
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.resolve(["text": ""])
                return
            }
            let finalText = self.latestTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
            self.tearDownAudio()
            self.notifyListeners("state", data: ["listening": false])
            call.resolve(["text": finalText])
        }
    }

    private func beginSession(localeId: String) throws {
        tearDownAudio()

        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeId))
            ?? SFSpeechRecognizer(locale: Locale(identifier: "tr-TR"))
            ?? SFSpeechRecognizer()
        guard let speechRecognizer = recognizer, speechRecognizer.isAvailable else {
            throw NSError(domain: "SpeechDictation", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Ses tanıma şu an kullanılamıyor."
            ])
        }
        self.speechRecognizer = speechRecognizer
        self.latestTranscript = ""
        self.sessionToken += 1
        let activeToken = self.sessionToken

        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker, .allowBluetooth])
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        let engine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if #available(iOS 16.0, *) {
            request.addsPunctuation = true
        }
        if speechRecognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = false
        }

        let inputNode = engine.inputNode
        let hwFormat = inputNode.outputFormat(forBus: 0)
        let tapFormat: AVAudioFormat? = (hwFormat.sampleRate > 0 && hwFormat.channelCount > 0) ? hwFormat : nil
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: tapFormat) { [weak request] buffer, _ in
            request?.append(buffer)
        }

        engine.prepare()
        try engine.start()

        self.audioEngine = engine
        self.recognitionRequest = request
        self.isListening = true
        self.notifyListeners("state", data: ["listening": true])

        self.recognitionTask = speechRecognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self = self, self.sessionToken == activeToken else { return }
                if let result = result {
                    let text = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !text.isEmpty {
                        self.latestTranscript = text
                        self.notifyListeners("partial", data: [
                            "text": text,
                            "isFinal": result.isFinal
                        ])
                    }
                    if result.isFinal {
                        let committed = self.latestTranscript
                        self.tearDownAudio()
                        self.notifyListeners("final", data: ["text": committed])
                        self.notifyListeners("state", data: ["listening": false])
                    }
                } else if let err = error {
                    if self.isListening {
                        let committed = self.latestTranscript
                        self.tearDownAudio()
                        if !committed.isEmpty {
                            self.notifyListeners("final", data: ["text": committed])
                        } else {
                            self.notifyListeners("error", data: ["message": err.localizedDescription])
                        }
                        self.notifyListeners("state", data: ["listening": false])
                    }
                }
            }
        }
    }

    private func tearDownAudio() {
        isListening = false
        if let engine = audioEngine {
            if engine.isRunning {
                engine.stop()
            }
            engine.inputNode.removeTap(onBus: 0)
        }
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        audioEngine = nil
        recognitionRequest = nil
        recognitionTask = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
