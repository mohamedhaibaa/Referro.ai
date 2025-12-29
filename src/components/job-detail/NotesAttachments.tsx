import { useState } from "react";
import { FileText, Upload, Tag, X } from "lucide-react";

interface NotesAttachmentsProps {
  tags: string[];
}

const NotesAttachments = ({ tags: initialTags }: NotesAttachmentsProps) => {
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState(initialTags);
  const [newTag, setNewTag] = useState("");

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  return (
    <div className="bg-card rounded-2xl p-6">
      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">Notes & Attachments</h2>
      
      {/* Notes */}
      <div className="mb-4">
        <label className="text-sm text-muted-foreground mb-2 block">What I learned / next steps</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Add your notes here..."
          className="w-full p-3 bg-muted rounded-xl border border-border text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Attachments */}
      <div className="mb-4">
        <label className="text-sm text-muted-foreground mb-2 block">Attachments</label>
        <button className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors">
          <Upload className="w-4 h-4" />
          <span className="text-sm">Upload files</span>
        </button>
      </div>

      {/* Tags */}
      <div>
        <label className="text-sm text-muted-foreground mb-2 block">Tags</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map(tag => (
            <span 
              key={tag} 
              className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
            >
              <Tag className="w-3 h-3" />
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-primary/70">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            placeholder="Add tag..."
            className="flex-1 px-3 py-1.5 bg-muted rounded border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button 
            onClick={addTag}
            className="px-3 py-1.5 bg-muted text-foreground rounded text-sm hover:bg-muted/80 transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotesAttachments;
