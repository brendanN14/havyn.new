import React from 'react';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/card-shadcn";
import { Button } from "@/components/ui/button-shadcn";
import { cn } from "@/lib/utils";
// Define the icon type. Using React.ElementType for flexibility.
type IconType = React.ElementType | React.FunctionComponent<React.SVGProps<SVGSVGElement>>;

// --- 📦 API (Props) Definition ---
export interface CardDisplayItem {
  /** A unique identifier for the card item. */
  id: string;
  /** Title of the card. */
  title: string;
  /** Main value or content of the card. */
  value: string;
  /** Detailed description or subtext. */
  description: string;
  /** Optional icon to display in the header. */
  icon?: IconType;
  /** Label for the optional footer action button. */
  actionLabel?: string;
  /** Disables the action button if true. */
  isDisabled?: boolean;
  /** Callback for when the action button is clicked. */
  onActionClick?: (id: string) => void;
}

export interface CardDisplayProps {
  /** Array of card items to display. */
  items: CardDisplayItem[];
  /** Optional class name to apply to the main container. */
  className?: string;
}

/**
 * A professional, monochrome, and responsive display for a collection of data cards.
 * Uses shadcn/ui components for styling, light/dark theme support, and accessibility.
 */
const CardDisplay: React.FC<CardDisplayProps> = ({ items, className }) => {
  if (!items || items.length === 0) {
    return <p className="text-center text-muted-foreground p-8">No display items configured.</p>;
  }

  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-4 md:p-6",
        className
      )}
      role="list" // ARIA role for a list of cards
    >
      {items.map((item) => (
        <Card
          key={item.id}
          className="flex flex-col h-full transition-shadow duration-200 hover:shadow-lg focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
          role="listitem" // ARIA role for a card item
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium tracking-tight text-foreground">
              {item.title}
            </CardTitle>
            {item.icon && (
              <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="text-2xl font-bold mb-1 text-foreground">{item.value}</div>
            <CardDescription className="text-xs text-muted-foreground min-h-[1.5rem]">
              {item.description}
            </CardDescription>
          </CardContent>
          {item.actionLabel && (
            <CardFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => item.onActionClick?.(item.id)}
                disabled={item.isDisabled}
                className="w-full text-sm font-semibold transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
                aria-label={`Action for ${item.title}: ${item.actionLabel}`}
              >
                {item.actionLabel}
              </Button>
            </CardFooter>
          )}
        </Card>
      ))}
    </div>
  );
};

export default CardDisplay;
