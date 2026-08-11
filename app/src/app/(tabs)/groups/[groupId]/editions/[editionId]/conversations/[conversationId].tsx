import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Send } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View,
} from "react-native";

import { normalizeApiError } from "@/api/errors";
import {
  createMessage,
  getConversationMessages,
  markConversationRead,
} from "@/api/generated/conversations/conversations";
import { AppScreen } from "@/components/common/app-screen";
import { ScreenState } from "@/components/common/screen-state";
import { MessageBubble } from "@/components/conversations/message-bubble";
import { Card, IconButton, Text } from "@/components/ui";
import {
  conversationTitle,
  formatMessageTime,
} from "@/features/conversations/presentation";
import { apiErrorMessage, parseRouteId } from "@/features/shared/presentation";
import { useFocusResource } from "@/hooks/use-focus-resource";
import { useMountedRef } from "@/hooks/use-mounted-ref";
import { palette } from "@/theme/tokens";

export default function ConversationThreadScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{
    groupId: string;
    editionId: string;
    conversationId: string;
  }>();
  const groupId = parseRouteId(params.groupId);
  const editionId = parseRouteId(params.editionId);
  const conversationId = parseRouteId(params.conversationId);
  const [body, setBody] = useState("");
  const [localError, setLocalError] = useState<string>();
  const [sendError, setSendError] = useState<unknown>();
  const [sending, setSending] = useState(false);
  const mounted = useMountedRef();
  const load = async (signal: AbortSignal) => {
    if (!groupId || !editionId || !conversationId) {
      throw new Error(t("common.errors.notFound"));
    }

    const thread = await getConversationMessages(
      groupId,
      editionId,
      conversationId,
      { signal },
    );
    await markConversationRead(
      groupId,
      editionId,
      conversationId,
      { messageId: thread.messages[thread.messages.length - 1]?.id ?? null },
      { signal },
    );

    return thread;
  };
  const resource = useFocusResource(load);

  useFocusEffect(() => {
    const interval = setInterval(resource.refresh, 5000);
    return () => clearInterval(interval);
  });

  const messages = [...(resource.data?.messages ?? [])].reverse();
  const fieldError = localError ?? normalizeApiError(sendError).fields?.body;

  async function send(): Promise<void> {
    if (!groupId || !editionId || !conversationId || sending) return;
    const value = body.trim();
    if (!value) {
      setLocalError(t("chat.messageRequired"));
      return;
    }

    setLocalError(undefined);
    setSendError(undefined);
    setSending(true);
    try {
      const message = await createMessage(groupId, editionId, conversationId, {
        body: value,
      });
      if (!mounted.current) return;
      resource.setData((current) =>
        current
          ? {
              ...current,
              conversation: {
                ...current.conversation,
                lastMessageAt: message.sentAt,
              },
              messages: [...current.messages, message],
            }
          : current,
      );
      setBody("");
      Keyboard.dismiss();
    } catch (exception) {
      if (!mounted.current) return;
      setSendError(exception);
    }
    if (mounted.current) setSending(false);
  }

  const title = resource.data
    ? conversationTitle(resource.data.conversation, t)
    : t("chat.title");
  const subtitle = resource.data
    ? t(
        resource.data.conversation.type === "edition"
          ? "chat.groupConversationHint"
          : resource.data.conversation.role === "giver"
            ? "chat.personYouDrew"
            : "chat.yourSecretSanta",
      )
    : undefined;

  return (
    <AppScreen title={title} subtitle={subtitle} back scroll={false}>
      {!resource.data ? (
        <ScreenState
          kind={resource.isLoading ? "loading" : "error"}
          title={resource.isLoading ? t("chat.loading") : t("chat.loadError")}
          message={
            resource.error ? apiErrorMessage(resource.error, t) : undefined
          }
          retryLabel={t("common.retry")}
          onRetry={resource.refresh}
        />
      ) : (
        <KeyboardAvoidingView
          className="flex-1 gap-3"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {resource.data.conversation.counterpart?.anonymous ? (
            <Card
              className="border border-pink-tint bg-pink-tint p-3"
              shadow="none"
            >
              <Text variant="caption" className="text-ink-soft">
                {t("chat.anonymousHint")}
              </Text>
            </Card>
          ) : null}

          <FlatList
            className="flex-1"
            data={messages}
            inverted
            keyExtractor={(message) => String(message.id)}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                time={formatMessageTime(item.sentAt, i18n.language)}
              />
            )}
            ListEmptyComponent={
              <ScreenState
                kind="empty"
                title={t("chat.noMessages")}
                message={t("chat.startConversation")}
              />
            }
          />

          {resource.data.conversation.canSend ? (
            <View className="gap-1.5">
              <View className="flex-row items-end gap-2 rounded-card border border-outline bg-card p-2 pl-4">
                <TextInput
                  className="max-h-28 min-h-11 flex-1 py-2 font-body-reg text-[16px] text-ink"
                  placeholder={t("chat.messagePlaceholder")}
                  placeholderTextColor={palette.inkMuted}
                  accessibilityLabel={t("chat.messagePlaceholder")}
                  value={body}
                  onChangeText={(value) => {
                    setBody(value);
                    setLocalError(undefined);
                    setSendError(undefined);
                  }}
                  multiline
                  maxLength={1000}
                  editable={!sending}
                />
                <IconButton
                  className="bg-mint disabled:opacity-50"
                  accessibilityLabel={t("chat.send")}
                  disabled={sending || !body.trim()}
                  onPress={() => void send()}
                >
                  {sending ? (
                    <ActivityIndicator color={palette.white} />
                  ) : (
                    <Send color={palette.white} size={19} />
                  )}
                </IconButton>
              </View>
              {fieldError ? (
                <Text
                  variant="caption"
                  className="px-2 text-pink-deep"
                  accessibilityRole="alert"
                >
                  {fieldError}
                </Text>
              ) : null}
            </View>
          ) : (
            <Card className="gap-1 p-4" shadow="none">
              <Text variant="bodyBold">{t("chat.archivedTitle")}</Text>
              <Text variant="caption">{t("chat.archivedBody")}</Text>
            </Card>
          )}
        </KeyboardAvoidingView>
      )}
    </AppScreen>
  );
}
