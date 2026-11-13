using Jod.Domain.Interfaces;
using Jod.Domain.RequestModels;
using Microsoft.AspNetCore.Mvc;
using Web.Jod.Extensions;

namespace Web.Jod.Controllers;

// Note: every action needs sign-in (fallback policy). The owner is always the signed-in user, never a value from the body
[ApiController]
[Route("api/notes")]
public class NotesController(INoteService noteService, INoteStructureService noteStructureService, INoteSearchService noteSearchService) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(CreateNoteRequestModel? request)
    {
        var note = await noteService.CreateAsync(User.GetUserId(), request ?? new CreateNoteRequestModel());
        return CreatedAtAction(nameof(Get), new { id = note.Id }, note);
    }

    [HttpPost("cards")]
    public async Task<IActionResult> Cards(NoteCardsRequestModel? request) =>
        Ok(new { items = await noteService.GetCardsAsync(User.GetUserId(), request ?? new NoteCardsRequestModel()) });

    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await noteService.ListAsync(User.GetUserId()));

    [HttpGet("trash")]
    public async Task<IActionResult> Trash() =>
        Ok(await noteStructureService.ListTrashAsync(User.GetUserId()));

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] int skip = 0, [FromQuery] Guid? parentId = null, [FromQuery] bool inTrash = false) =>
        Ok(await noteSearchService.SearchAsync(User.GetUserId(), q, skip, parentId, inTrash));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id) =>
        Ok(await noteService.GetAsync(User.GetUserId(), id));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateNoteRequestModel request) =>
        Ok(await noteService.UpdateAsync(User.GetUserId(), id, request));

    [HttpPut("{id:guid}/placement")]
    public async Task<IActionResult> Move(Guid id, MoveNoteRequestModel request) =>
        Ok(await noteStructureService.MoveAsync(User.GetUserId(), id, request));

    [HttpPost("{id:guid}/discard-empty")]
    public async Task<IActionResult> DiscardEmpty(Guid id, DiscardEmptyNoteRequestModel request) =>
        Ok(new { discarded = await noteStructureService.DiscardEmptyAsync(User.GetUserId(), id, request) });

    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id) =>
        Ok(await noteStructureService.RestoreAsync(User.GetUserId(), id));

    [HttpDelete("{id:guid}/permanent")]
    public async Task<IActionResult> DeletePermanently(Guid id) =>
        Ok(new { deletedCount = await noteStructureService.DeletePermanentlyAsync(User.GetUserId(), id) });

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, [FromQuery] string scope = "branch") =>
        Ok(new { deletedCount = await noteStructureService.DeleteAsync(User.GetUserId(), id, scope) });
}
