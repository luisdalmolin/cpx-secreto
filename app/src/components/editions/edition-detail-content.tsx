import { router } from "expo-router";
import {
  Ban,
  CreditCard,
  Eye,
  Gift,
  Heart,
  List,
  MessageCircle,
  Shuffle,
  Users,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import type { Edition } from "@/api/generated/models";
import { Badge, Button, Card, Text } from "@/components/ui";
import { formatCurrency, formatDate } from "@/features/shared/presentation";
import { palette } from "@/theme/tokens";

interface EditionRouteParams {
  [key: string]: string;
  groupId: string;
  editionId: string;
}

interface EditionDetailContentProps {
  edition: Edition;
  participantCount: number;
  isAdmin: boolean;
  isParticipant: boolean;
  mutating: boolean;
  routeParams: EditionRouteParams;
  onOpen(): void;
  onReveal(): void;
  onArchive(): void;
}

export function EditionDetailContent({
  edition,
  participantCount,
  isAdmin,
  isParticipant,
  mutating,
  routeParams,
  onOpen,
  onReveal,
  onArchive,
}: EditionDetailContentProps) {
  const canEditRoster = edition.status === "draft" || edition.status === "open";

  return (
    <>
      <EditionSummaryCard edition={edition} />
      <RosterCard
        participantCount={participantCount}
        canEdit={canEditRoster && isAdmin}
        routeParams={routeParams}
      />
      {isParticipant ? (
        <ParticipantCards edition={edition} routeParams={routeParams} />
      ) : null}
      {canEditRoster && isAdmin ? (
        <AdminDrawCard
          edition={edition}
          mutating={mutating}
          routeParams={routeParams}
          onOpen={onOpen}
        />
      ) : null}
      {edition.status === "drawn" ||
      edition.status === "revealed" ||
      edition.status === "archived" ? (
        <AssignmentCard
          edition={edition}
          isAdmin={isAdmin}
          mutating={mutating}
          routeParams={routeParams}
          onReveal={onReveal}
          onArchive={onArchive}
        />
      ) : null}
    </>
  );
}

function EditionSummaryCard({ edition }: { edition: Edition }) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3 p-5">
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="section">{t("editions.type")}</Text>
        <Badge
          label={t(`editions.status.${edition.status}`)}
          variant={
            edition.status === "drawn" || edition.status === "revealed"
              ? "success"
              : "neutral"
          }
        />
      </View>
      {edition.budgetCents !== null && edition.budgetCents !== undefined ? (
        <Text variant="caption">
          {t("editions.budgetLabel", {
            value: formatCurrency(edition.budgetCents, edition.currency),
          })}
        </Text>
      ) : null}
      {edition.eventDate ? (
        <Text variant="caption">
          {t("editions.eventDateLabel", {
            value: formatDate(edition.eventDate),
          })}
        </Text>
      ) : null}
    </Card>
  );
}

function RosterCard({
  participantCount,
  canEdit,
  routeParams,
}: {
  participantCount: number;
  canEdit: boolean;
  routeParams: EditionRouteParams;
}) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3 p-5">
      <View className="flex-row items-center gap-3">
        <Users color={palette.mint} size={22} />
        <View className="flex-1">
          <Text variant="cardTitle">{t("editions.roster")}</Text>
          <Text variant="caption">
            {t("editions.rosterCount", { count: participantCount })}
          </Text>
        </View>
      </View>
      {canEdit ? (
        <Button
          label={t("editions.editRoster")}
          variant="light"
          onPress={() =>
            router.push({
              pathname: "/groups/[groupId]/editions/[editionId]/roster",
              params: routeParams,
            })
          }
        />
      ) : null}
    </Card>
  );
}

function ParticipantCards({
  edition,
  routeParams,
}: {
  edition: Edition;
  routeParams: EditionRouteParams;
}) {
  const { t } = useTranslation();
  const canPurchase = edition.status === "draft" || edition.status === "open";

  return (
    <>
      <NavigationCard
        icon={<Heart color={palette.pink} size={22} />}
        title={t("wishes.title")}
        hint={t("wishes.editionHint")}
        label={t("wishes.openMine")}
        buttonIcon={<List color={palette.mintDeep} size={18} />}
        onPress={() =>
          router.push({
            pathname: "/groups/[groupId]/editions/[editionId]/wishes",
            params: routeParams,
          })
        }
      />
      {canPurchase ? (
        <NavigationCard
          icon={<CreditCard color={palette.mintDeep} size={22} />}
          title={t("orders.cardTitle")}
          hint={t("orders.cardHint")}
          label={t("orders.open")}
          onPress={() =>
            router.push({
              pathname: "/groups/[groupId]/editions/[editionId]/pick",
              params: routeParams,
            })
          }
        />
      ) : null}
      <NavigationCard
        icon={<MessageCircle color={palette.mintDeep} size={22} />}
        title={t("chat.groupConversation")}
        hint={t("chat.groupConversationHint")}
        label={t("chat.open")}
        onPress={() =>
          router.push({
            pathname: "/groups/[groupId]/editions/[editionId]/conversations",
            params: routeParams,
          })
        }
      />
    </>
  );
}

function NavigationCard({
  icon,
  title,
  hint,
  label,
  buttonIcon,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  label: string;
  buttonIcon?: React.ReactNode;
  onPress(): void;
}) {
  return (
    <Card className="gap-3 p-5">
      <View className="flex-row items-center gap-3">
        {icon}
        <View className="flex-1">
          <Text variant="cardTitle">{title}</Text>
          <Text variant="caption">{hint}</Text>
        </View>
      </View>
      <Button
        label={label}
        variant="light"
        leftIcon={buttonIcon}
        onPress={onPress}
      />
    </Card>
  );
}

function AdminDrawCard({
  edition,
  mutating,
  routeParams,
  onOpen,
}: {
  edition: Edition;
  mutating: boolean;
  routeParams: EditionRouteParams;
  onOpen(): void;
}) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3 p-5">
      <Text variant="section">{t("editions.drawArea")}</Text>
      <Button
        label={t("draw.constraints.manage")}
        variant="light"
        leftIcon={<Ban color={palette.mintDeep} size={18} />}
        onPress={() =>
          router.push({
            pathname: "/groups/[groupId]/editions/[editionId]/constraints",
            params: routeParams,
          })
        }
      />
      {edition.status === "draft" ? (
        <Button
          label={t("editions.open")}
          onPress={onOpen}
          disabled={mutating}
        />
      ) : null}
      {edition.status === "open" ? (
        <Button
          label={t("editions.drawArea")}
          variant="pink"
          leftIcon={<Shuffle color={palette.white} size={18} />}
          onPress={() =>
            router.push({
              pathname: "/groups/[groupId]/editions/[editionId]/draw",
              params: routeParams,
            })
          }
        />
      ) : null}
    </Card>
  );
}

function AssignmentCard({
  edition,
  isAdmin,
  mutating,
  routeParams,
  onReveal,
  onArchive,
}: {
  edition: Edition;
  isAdmin: boolean;
  mutating: boolean;
  routeParams: EditionRouteParams;
  onReveal(): void;
  onArchive(): void;
}) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3 p-5">
      <Text variant="section">{t("editions.drawArea")}</Text>
      <Button
        label={t("editions.myAssignment")}
        leftIcon={<Gift color={palette.white} size={18} />}
        onPress={() =>
          router.push({
            pathname: "/groups/[groupId]/editions/[editionId]/assignment",
            params: routeParams,
          })
        }
      />
      {edition.status === "revealed" || edition.status === "archived" ? (
        <Button
          label={t("editions.allAssignments")}
          variant="light"
          leftIcon={<List color={palette.mintDeep} size={18} />}
          onPress={() =>
            router.push({
              pathname: "/groups/[groupId]/editions/[editionId]/assignments",
              params: routeParams,
            })
          }
        />
      ) : null}
      {edition.status === "drawn" && isAdmin ? (
        <Button
          label={t("editions.reveal")}
          variant="pink"
          leftIcon={<Eye color={palette.white} size={18} />}
          onPress={onReveal}
          disabled={mutating}
        />
      ) : null}
      {edition.status === "revealed" && isAdmin ? (
        <Button
          label={t("editions.archive")}
          variant="light"
          onPress={onArchive}
          disabled={mutating}
        />
      ) : null}
    </Card>
  );
}
