import React from "react";
import { Heart, Pencil, Trash2, Users, Clock, MessageSquare } from "lucide-react";
import { FollowButton } from "@/components/ui/FollowButton";
import LazyImage from "@/components/ui/LazyImage";
import { getFallbackEventImage, isValidEventId } from "@/features/trending/trendingModel";
import type { TrendingEvent } from "@/features/trending/trendingModel";
import {
  formatRelativeTime,
  getEventStatus,
  getStatusBadgeColor,
  getStatusText,
} from "@/lib/date-utils";
import { useTranslations } from "@/lib/i18n";

type AdminActionsProps = {
  eventId: number | null;
  deleteBusyId: number | null;
  onEdit: (event: React.MouseEvent) => void;
  onDelete: (event: React.MouseEvent) => void;
  editAriaLabel: string;
  deleteAriaLabel: string;
};

function AdminActions({
  eventId,
  deleteBusyId,
  onEdit,
  onDelete,
  editAriaLabel,
  deleteAriaLabel,
}: AdminActionsProps) {
  if (!isValidEventId(eventId)) return null;

  return (
    <div className="absolute top-3 right-3 z-10 flex gap-2">
      <button
        onClick={onEdit}
        className="px-2 py-1 rounded-full bg-white/90 border border-gray-300 text-gray-800 shadow"
        aria-label={editAriaLabel}
      >
        <Pencil className="w-4 h-4" />
      </button>
      <button
        onClick={onDelete}
        className="px-2 py-1 rounded-full bg-red-600 text-white shadow disabled:opacity-50"
        disabled={deleteBusyId === eventId}
        aria-label={deleteAriaLabel}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
type TrendingEventCardProps = {
  product: TrendingEvent;
  eventId: number | null;
  isFollowed: boolean;
  isFollowPending?: boolean;
  isAdmin: boolean;
  deleteBusyId: number | null;
  onCardClick: (event: React.MouseEvent, category?: string) => void;
  onToggleFollow: (event: React.MouseEvent, eventId: number) => void;
  onEdit: (event: React.MouseEvent, product: TrendingEvent) => void;
  onDelete: (event: React.MouseEvent, id: number) => void;
  tTrending: (key: string) => string;
  tTrendingAdmin: (key: string) => string;
  tEvents: (key: string) => string;
};

export const TrendingEventCard = React.memo(function TrendingEventCard({
  product,
  eventId,
  isFollowed,
  isFollowPending,
  isAdmin,
  deleteBusyId,
  onCardClick,
  onToggleFollow,
  onEdit,
  onDelete,
  tTrending,
  tTrendingAdmin,
  tEvents,
}: TrendingEventCardProps) {
  const t = useTranslations();
  const stopClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleCardClick = (e: React.MouseEvent) => {
    onCardClick(e, product.tag);
  };

  const handleEdit = (e: React.MouseEvent) => {
    stopClick(e);
    onEdit(e, product);
  };

  const handleDelete = (e: React.MouseEvent) => {
    stopClick(e);
    if (!isValidEventId(eventId)) return;
    onDelete(e, eventId);
  };
  const eventStatus = getEventStatus(
    product.deadline ?? Date.now(),
    product.status === "completed" || product.status === "cancelled"
  );
  const statusBadgeColor = getStatusBadgeColor(eventStatus);
  const statusBadgeText = getStatusText(eventStatus, t);

  const imageElement = (
    <div className="relative h-40 overflow-hidden bg-gray-100 group">
      <LazyImage
        src={product.image}
        alt={product.title}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        placeholderClassName="bg-gradient-to-br from-gray-200 to-gray-300"
        fallbackSrc={getFallbackEventImage(product.title)}
        rootMargin={100}
        fadeIn={true}
      />

      {/* Gradient overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Deadline info on hover */}
      {product.deadline && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Clock className="w-3 h-3 text-white" />
          <span className="text-[10px] font-medium text-white">
            {formatRelativeTime(product.deadline)}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="glass-card glass-card-hover rounded-2xl overflow-hidden relative transform-gpu flex flex-col h-full min-h-[250px] group transition-transform duration-150 hover:scale-[1.01] active:scale-[0.99]"
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick(e as any);
        }
      }}
    >
      {isValidEventId(eventId) && (
        <FollowButton
          isFollowed={isFollowed}
          dataEventId={eventId}
          onClick={(e) => {
            stopClick(e);
            if (!isValidEventId(eventId)) return;
            onToggleFollow(e, eventId);
          }}
          disabled={isFollowPending}
          className="absolute top-3 left-3 z-10"
        />
      )}

      {isAdmin && (
        <AdminActions
          eventId={eventId}
          deleteBusyId={deleteBusyId}
          onEdit={handleEdit}
          onDelete={handleDelete}
          editAriaLabel={tTrendingAdmin("editAria")}
          deleteAriaLabel={tTrendingAdmin("deleteAria")}
        />
      )}

      {imageElement}

      <div className="p-4 flex flex-col flex-1">
        {/* 标题区域 - 弹性填充 */}
        <div className="flex-1 min-h-[3rem]">
          <h4 className="font-bold text-gray-900 text-base line-clamp-2 group-hover:text-purple-700 transition-colors duration-300">
            {tEvents(product.title)}
          </h4>
          {product.description && (
            <p className="text-xs text-gray-500 line-clamp-2 mt-1 transition-colors duration-300 group-hover:text-gray-600">
              {product.description}
            </p>
          )}
        </div>

        {/* 统计信息 - 固定在底部 */}
        <div className="mt-auto pt-3 border-t border-gray-100">
          {/* Primary stats */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-100 hover:bg-purple-100 transition-colors duration-300">
                {tTrending("card.volumePrefix")}
                {Number(product?.stats?.totalAmount || 0).toFixed(2)}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${statusBadgeColor}`}>
                {statusBadgeText}
              </span>
            </div>

            {/* Deadline info (always visible on mobile) */}
            {product.deadline && (
              <div className="flex items-center text-gray-500 text-[10px] font-medium gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatRelativeTime(product.deadline)}</span>
              </div>
            )}
          </div>

          {/* Secondary stats */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center text-gray-500 text-[10px] font-medium hover:text-purple-600 transition-colors duration-300">
                <Users className="w-3 h-3 mr-1" />
                <span>{Number(product?.stats?.participantCount || 0)}</span>
              </div>
              <div className="flex items-center text-gray-500 text-[10px] font-medium hover:text-pink-600 transition-colors duration-300">
                <Heart className="w-3 h-3 mr-1" />
                <span>{product.followers_count || 0}</span>
              </div>
              <div className="flex items-center text-gray-500 text-[10px] font-medium hover:text-blue-600 transition-colors duration-300">
                <MessageSquare className="w-3 h-3 mr-1" />
                <span>{Number(product?.stats?.commentCount || 0)}</span>
              </div>
            </div>
          </div>

          {/* Outcomes */}
          {Array.isArray(product.outcomes) && product.outcomes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {product.outcomes.slice(0, 4).map((o: any, oi: number) => (
                <span
                  key={oi}
                  className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-50 text-gray-600 border border-gray-200/60 hover:bg-gray-100 hover:border-gray-300 transition-all duration-300 transform hover:scale-105"
                >
                  {String(o?.label || `${tTrending("card.optionFallbackPrefix")}${oi}`)}
                </span>
              ))}
              {product.outcomes.length > 4 && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-50 text-gray-400 border border-gray-200/60 hover:bg-gray-100 transition-colors duration-300">
                  +{product.outcomes.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
